"""The daily run: collect the open calls, find the new ones, send each user their digest."""

import hashlib
import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Protocol

from postthedoc.digest import DigestRenderer
from postthedoc.links import LinkBuilder
from postthedoc.mail import Mailer, MailError, MailerUnavailableError
from postthedoc.matching import match_all
from postthedoc.models import Call, User
from postthedoc.sources import Source
from postthedoc.storage import D1Error, SeenStore

log = logging.getLogger(__name__)

# Recording a delivery is retried before giving up: an unrecorded digest is sent again next time.
RECORD_ATTEMPTS = 3
RECORD_BACKOFF_SECONDS = 2.0


class DeliveryLog(Protocol):
    """Which calls were already sent to whom (the D1 "deliveries" table)."""

    def delivered(self, call_ids: Sequence[str]) -> set[tuple[str, str]]: ...

    def record_deliveries(self, user_id: str, call_ids: Sequence[str]) -> None: ...


@dataclass
class Report:
    fetched: int = 0
    new: int = 0
    retried: int = 0  # calls sent again to whoever missed them on a previous run
    emails_sent: int = 0
    bootstrap: bool = False
    failed_sources: list[str] = field(default_factory=list)
    failed_deliveries: list[str] = field(default_factory=list)  # user ids
    # Digests sent but missing from the delivery log: they will be sent again.
    unrecorded_deliveries: list[str] = field(default_factory=list)  # user ids
    # Digests not attempted after sending stopped (quota used up, delivery log down).
    skipped_deliveries: list[str] = field(default_factory=list)  # user ids
    # Calls that did not reach every matching user within the retry window.
    abandoned_calls: list[str] = field(default_factory=list)
    # Calls left for the next run because some of their data could not be read.
    incomplete_calls: list[str] = field(default_factory=list)
    # Whether the seen calls registry is consistent with what was sent, and can be saved.
    seen_updated: bool = False

    @property
    def ok(self) -> bool:
        return not (
            self.failed_sources
            or self.failed_deliveries
            or self.unrecorded_deliveries
            or self.skipped_deliveries
        )


class Outcome(Enum):
    DELIVERED = "delivered"  # sent and recorded
    FAILED = "failed"  # not sent: try the next user
    STOP = "stop"  # stop sending: the next ones would fail too, or could not be recorded


@dataclass(frozen=True)
class Delivery:
    user: User
    calls: list[Call]


class Pipeline:
    def __init__(
        self,
        sources: Sequence[Source],
        store: SeenStore,
        mailer: Mailer,
        links: LinkBuilder,
        renderer: DigestRenderer,
        deliveries: DeliveryLog | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._sources = tuple(sources)
        self._store = store
        self._mailer = mailer
        self._links = links
        self._renderer = renderer
        self._deliveries = deliveries
        self._clock = clock
        self._sleep = sleep

    def run(self, users: Sequence[User], *, all_open: bool = False) -> Report:
        """With `all_open`, every open call counts as new (to preview digests)."""
        now = self._clock()
        report = Report()

        calls = self._collect(report)
        if not self._store.exists and not all_open:
            return self._bootstrap(calls, now, report)

        new = calls if all_open else [c for c in calls if c.id not in self._store]
        retries = self._store.retries()
        # Retried calls are in the registry already, so never among the new ones.
        retry = [] if all_open else [c for c in calls if c.id in retries]
        report.new, report.retried = len(new), len(retry)
        log.info("%d open calls, %d new, %d to send again", len(calls), len(new), len(retry))
        # Calls missing data (e.g. their sector, on a detail page that failed to load) would not
        # reach who filters on it: they wait for the next run, as if not seen yet.
        incomplete = self._enrich([*new, *retry])
        if incomplete:
            log.warning("Left for the next run, incomplete: %s", ", ".join(sorted(incomplete)))
            report.incomplete_calls = sorted(incomplete)
            new = [c for c in new if c.id not in incomplete]
            retry = [c for c in retry if c.id not in incomplete]

        undelivered: list[Delivery] = []
        plan = self._plan([*new, *retry], users, now)
        for i, delivery in enumerate(plan):
            outcome = self._deliver(delivery, now, report)
            if outcome is not Outcome.DELIVERED:
                undelivered.append(delivery)
            if outcome is Outcome.STOP:
                undelivered.extend(plan[i + 1 :])
                report.skipped_deliveries.extend(d.user.id for d in plan[i + 1 :])
                log.error("No more digests today: %d not sent", len(plan) - i - 1)
                break

        self._store.add(new, now)
        self._store.prune(now)
        # The calls someone missed are sent again on the next runs: the delivery log keeps them
        # from reaching twice whoever already got them.
        report.abandoned_calls = self._store.update_retries(
            done=[c.id for c in retry],
            undelivered={c.id for d in undelivered for c in d.calls},
            now=now,
        )
        if report.abandoned_calls:
            log.error("Given up on sending again: %s", ", ".join(report.abandoned_calls))
        report.seen_updated = True
        return report

    def _bootstrap(self, calls: Sequence[Call], now: datetime, report: Report) -> Report:
        """First run: record the open calls without mailing hundreds of them."""
        if report.failed_sources:
            # The calls of the failed sources would all look new tomorrow: mass mailing.
            log.error("Cannot bootstrap: %s failed", ", ".join(report.failed_sources))
            return report
        log.info("No seen.json: recording %d calls without sending notifications", len(calls))
        self._store.add(calls, now)
        report.bootstrap = True
        report.seen_updated = True
        return report

    def _collect(self, report: Report) -> list[Call]:
        """Open calls from every source, without duplicates."""
        calls: dict[str, Call] = {}
        for source in self._sources:
            result = source.fetch()
            report.failed_sources.extend(result.failures)
            for call in result.calls:
                calls.setdefault(call.id, call)
        report.fetched = len(calls)
        return list(calls.values())

    def _enrich(self, calls: Sequence[Call]) -> set[str]:
        """Complete the calls; the ids of those that could not be."""
        incomplete: set[str] = set()
        for source in self._sources:
            incomplete.update(source.enrich([c for c in calls if c.source == source.name]))
        return incomplete

    def _plan(self, calls: Sequence[Call], users: Sequence[User], now: datetime) -> list[Delivery]:
        """Matching calls per user, minus those already sent to them.

        Users come in an order that changes every day: if sending stops midway (the provider's
        daily quota), the same users are not always the ones left waiting.
        """
        matched = match_all(calls, users)
        sent = (
            self._deliveries.delivered([c.id for c in calls])
            if self._deliveries and calls
            else set()
        )
        day = now.date().isoformat()

        def rotation(user: User) -> bytes:
            return hashlib.sha256(f"{day}:{user.id}".encode()).digest()

        plan = []
        for user in sorted(users, key=rotation):
            todo = [c for c in matched.get(user.id, []) if (user.id, c.id) not in sent]
            if todo:
                plan.append(Delivery(user, todo))
        return plan

    def _deliver(self, delivery: Delivery, now: datetime, report: Report) -> Outcome:
        """Send one digest and record it."""
        user = delivery.user
        email = self._renderer.render(
            user.email, delivery.calls, user.locale, self._links.digest_links(user), now.date()
        )
        try:
            self._mailer.send(email)
        except MailError as exc:
            log.error("Sending to %s failed: %s", user.id, exc)
            report.failed_deliveries.append(user.id)
            return Outcome.STOP if isinstance(exc, MailerUnavailableError) else Outcome.FAILED
        report.emails_sent += 1
        if not self._record(user, delivery.calls):
            # A digest sent but not recorded goes out again: do not multiply that by every user.
            log.error("The delivery log is unavailable")
            report.unrecorded_deliveries.append(user.id)
            return Outcome.STOP
        return Outcome.DELIVERED

    def _record(self, user: User, calls: Sequence[Call]) -> bool:
        if self._deliveries is None:
            return True
        for attempt in range(1, RECORD_ATTEMPTS + 1):
            try:
                self._deliveries.record_deliveries(user.id, [c.id for c in calls])
            except D1Error as exc:
                log.warning("Recording the digest of %s failed (%d): %s", user.id, attempt, exc)
                if attempt < RECORD_ATTEMPTS:
                    self._sleep(RECORD_BACKOFF_SECONDS * attempt)
            else:
                return True
        log.error("Digest sent to %s but not recorded: it will be sent again", user.id)
        return False
