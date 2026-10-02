"""The daily run: collect the open calls, find the new and the changed ones, send each user their
digest."""

import hashlib
import logging
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Protocol

from postthedoc.digest import DigestRenderer
from postthedoc.links import LinkBuilder
from postthedoc.mail import Mailer, MailError, MailerUnavailableError
from postthedoc.matching import match_all
from postthedoc.models import WITHDRAWN, Call, CallUpdate, User
from postthedoc.sources import Source
from postthedoc.storage import D1Error, SeenStore

log = logging.getLogger(__name__)

# Recording a delivery is retried before giving up: an unrecorded digest is sent again next time.
RECORD_ATTEMPTS = 3
RECORD_BACKOFF_SECONDS = 2.0


class DeliveryLog(Protocol):
    """Which calls were already sent to whom, and which of their changes they were told (the D1
    "deliveries" and "call_updates" tables)."""

    def delivered(self, call_ids: Sequence[str]) -> set[tuple[str, str]]: ...

    def delivery_times(self, call_ids: Sequence[str]) -> dict[tuple[str, str], datetime]: ...

    def record_deliveries(self, user_id: str, call_ids: Sequence[str]) -> None: ...

    def updates_sent(self, call_ids: Sequence[str]) -> set[tuple[str, str, datetime]]: ...

    def record_updates(self, user_id: str, changes: Sequence[tuple[str, datetime]]) -> None: ...


@dataclass
class Report:
    fetched: int = 0
    new: int = 0
    retried: int = 0  # calls sent again to whoever missed them on a previous run
    changed: int = 0  # seen calls found changed, withdrawn included
    withdrawn: int = 0  # seen calls no longer open before their deadline
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
    # Whether the changes to calls already sent could not be told (the delivery log is down).
    updates_unavailable: bool = False
    # Whether the seen calls registry is consistent with what was sent, and can be saved.
    seen_updated: bool = False

    @property
    def empty(self) -> bool:
        """No open call anywhere: the portal answering empty pages, rather than a quiet day."""
        return self.fetched == 0

    @property
    def ok(self) -> bool:
        return not (
            self.empty
            or self.failed_sources
            or self.failed_deliveries
            or self.unrecorded_deliveries
            or self.skipped_deliveries
            or self.updates_unavailable
        )


class Outcome(Enum):
    DELIVERED = "delivered"  # sent and recorded
    FAILED = "failed"  # not sent: try the next user
    STOP = "stop"  # stop sending: the next ones would fail too, or could not be recorded


@dataclass(frozen=True)
class Delivery:
    user: User
    calls: list[Call]
    updates: list[CallUpdate] = field(default_factory=list)


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

        calls, scopes = self._collect(report)
        if report.empty:
            log.error("No open calls from any source: is the portal answering empty pages?")
        if not self._store.exists and not all_open:
            return self._bootstrap(calls, now, report)
        if not all_open:
            self._observe(calls, [] if report.empty else scopes, now, report)

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

        updates = {} if all_open else self._updates(users, now, report)
        undelivered: list[Delivery] = []
        plan = self._plan([*new, *retry], users, now, updates)
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
        self._store.describe(calls)
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
        if report.failed_sources or report.empty:
            # The calls missing now would all look new tomorrow: mass mailing.
            failed = ", ".join(report.failed_sources) or "every source is empty"
            log.error("Cannot bootstrap: %s", failed)
            return report
        log.info("No seen.json: recording %d calls without sending notifications", len(calls))
        self._store.add(calls, now)
        report.bootstrap = True
        report.seen_updated = True
        return report

    def _collect(self, report: Report) -> tuple[list[Call], list[str]]:
        """Open calls from every source, without duplicates, and the scopes read in full."""
        calls: dict[str, Call] = {}
        scopes: list[str] = []
        for source in self._sources:
            result = source.fetch()
            report.failed_sources.extend(result.failures)
            scopes.extend(result.scopes)
            for call in result.calls:
                calls.setdefault(call.id, call)
        report.fetched = len(calls)
        return list(calls.values()), scopes

    def _observe(
        self, calls: Sequence[Call], scopes: Sequence[str], now: datetime, report: Report
    ) -> None:
        """Record what changed in the calls already seen."""
        changes = self._store.observe(calls, scopes, now)
        for call_id, change in changes:
            log.info("%s changed: %s %r -> %r", call_id, change.field, change.old, change.new)
        report.changed = len({call_id for call_id, _ in changes})
        report.withdrawn = sum(c.field == "status" and c.new == WITHDRAWN for _, c in changes)

    def _updates(
        self, users: Sequence[User], now: datetime, report: Report
    ) -> dict[str, list[CallUpdate]]:
        """User id -> the recent changes to calls they got before each change, not told yet.

        Whoever got a call is told even if their preferences no longer match it: they may have
        applied already.
        """
        recent = self._store.recent_changes(now)
        if not recent or self._deliveries is None:
            return {}
        call_ids = sorted(recent)
        try:
            sent_at = self._deliveries.delivery_times(call_ids)
            told = self._deliveries.updates_sent(call_ids)
        except D1Error as exc:
            log.error("Changes to calls already sent not told today: %s", exc)
            report.updates_unavailable = True
            return {}
        active = {user.id for user in users}
        entries = self._store.entries()
        updates: dict[str, list[CallUpdate]] = {}
        for (user_id, call_id), sent in sorted(sent_at.items()):
            seen = entries[call_id].call
            todo = [
                change
                for change in recent[call_id]
                if change.at > sent and (user_id, call_id, change.at) not in told
            ]
            if user_id not in active or not todo or seen is None:
                continue
            updates.setdefault(user_id, []).append(
                CallUpdate(
                    id=call_id,
                    title=seen.title,
                    url=seen.url,
                    institution_name=seen.institution_name,
                    region=seen.region,
                    deadline=entries[call_id].deadline,
                    changes=todo,
                )
            )
        return updates

    def _enrich(self, calls: Sequence[Call]) -> set[str]:
        """Complete the calls; the ids of those that could not be."""
        incomplete: set[str] = set()
        for source in self._sources:
            incomplete.update(source.enrich([c for c in calls if c.source == source.name]))
        return incomplete

    def _plan(
        self,
        calls: Sequence[Call],
        users: Sequence[User],
        now: datetime,
        updates: Mapping[str, list[CallUpdate]],
    ) -> list[Delivery]:
        """Matching calls per user, minus those already sent to them, and their `updates`.

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
            told = updates.get(user.id, [])
            if todo or told:
                plan.append(Delivery(user, todo, told))
        return plan

    def _deliver(self, delivery: Delivery, now: datetime, report: Report) -> Outcome:
        """Send one digest and record it."""
        user = delivery.user
        try:
            email = self._renderer.render(
                user.email,
                delivery.calls,
                user.locale,
                self._links.digest_links(user),
                now.date(),
                delivery.updates,
            )
        except Exception:
            # A bug with one user's data (say, an unknown code) must not stop everybody else's.
            log.exception("Rendering the digest of %s failed", user.id)
            report.failed_deliveries.append(user.id)
            return Outcome.FAILED
        try:
            self._mailer.send(email)
        except MailError as exc:
            log.error("Sending to %s failed: %s", user.id, exc)
            report.failed_deliveries.append(user.id)
            return Outcome.STOP if isinstance(exc, MailerUnavailableError) else Outcome.FAILED
        report.emails_sent += 1
        if not self._record(delivery):
            # A digest sent but not recorded goes out again: do not multiply that by every user.
            log.error("The delivery log is unavailable")
            report.unrecorded_deliveries.append(user.id)
            return Outcome.STOP
        return Outcome.DELIVERED

    def _record(self, delivery: Delivery) -> bool:
        if self._deliveries is None:
            return True
        user = delivery.user
        changes = [(u.id, change.at) for u in delivery.updates for change in u.changes]
        for attempt in range(1, RECORD_ATTEMPTS + 1):
            try:
                if delivery.calls:
                    self._deliveries.record_deliveries(user.id, [c.id for c in delivery.calls])
                if changes:
                    self._deliveries.record_updates(user.id, changes)
            except D1Error as exc:
                log.warning("Recording the digest of %s failed (%d): %s", user.id, attempt, exc)
                if attempt < RECORD_ATTEMPTS:
                    self._sleep(RECORD_BACKOFF_SECONDS * attempt)
            else:
                return True
        log.error("Digest sent to %s but not recorded: it will be sent again", user.id)
        return False
