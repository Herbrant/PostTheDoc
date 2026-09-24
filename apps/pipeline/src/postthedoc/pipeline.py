"""The daily run: collect the open calls, find the new ones, send each user their digest."""

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from postthedoc.digest import DigestRenderer
from postthedoc.links import LinkBuilder
from postthedoc.mail import Mailer, MailError
from postthedoc.matching import match_all
from postthedoc.models import Call, User
from postthedoc.sources import Source
from postthedoc.storage import D1Error, SeenStore

log = logging.getLogger(__name__)


class DeliveryLog(Protocol):
    """Which calls were already sent to whom (the D1 "deliveries" table)."""

    def delivered(self, call_ids: Sequence[str]) -> set[tuple[str, str]]: ...

    def record_deliveries(self, user_id: str, call_ids: Sequence[str]) -> None: ...


@dataclass
class Report:
    fetched: int = 0
    new: int = 0
    emails_sent: int = 0
    bootstrap: bool = False
    failed_sources: list[str] = field(default_factory=list)
    failed_deliveries: list[str] = field(default_factory=list)  # user ids

    @property
    def ok(self) -> bool:
        return not (self.failed_sources or self.failed_deliveries)


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
    ) -> None:
        self._sources = tuple(sources)
        self._store = store
        self._mailer = mailer
        self._links = links
        self._renderer = renderer
        self._deliveries = deliveries
        self._clock = clock

    def run(self, users: Sequence[User], *, all_open: bool = False) -> Report:
        """With `all_open`, every open call counts as new (to preview digests)."""
        now = self._clock()
        report = Report()

        calls = self._collect(report)
        if not self._store.exists and not all_open:
            # First run: record the current state without mailing hundreds of already open calls.
            log.info("No seen.json: recording %d calls without sending notifications", len(calls))
            self._store.add(calls)
            report.bootstrap = True
            return report

        new = calls if all_open else [c for c in calls if c.id not in self._store]
        report.new = len(new)
        log.info("%d open calls, %d new", len(calls), len(new))
        self._enrich(new)

        for delivery in self._plan(new, users):
            self._deliver(delivery, now, report)

        self._store.add(new)
        self._store.prune(now)
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

    def _enrich(self, calls: Sequence[Call]) -> None:
        for source in self._sources:
            source.enrich([c for c in calls if c.source == source.name])

    def _plan(self, calls: Sequence[Call], users: Sequence[User]) -> list[Delivery]:
        """Matching calls per user, minus those already sent to them."""
        matched = match_all(calls, users)
        sent = (
            self._deliveries.delivered([c.id for c in calls])
            if self._deliveries and calls
            else set()
        )
        plan = []
        for user in users:
            todo = [c for c in matched.get(user.id, []) if (user.id, c.id) not in sent]
            if todo:
                plan.append(Delivery(user, todo))
        return plan

    def _deliver(self, delivery: Delivery, now: datetime, report: Report) -> None:
        user = delivery.user
        email = self._renderer.render(
            user.email, delivery.calls, user.locale, self._links.digest_links(user), now.date()
        )
        try:
            self._mailer.send(email)
            if self._deliveries:
                self._deliveries.record_deliveries(user.id, [c.id for c in delivery.calls])
        except (MailError, D1Error) as exc:
            log.error("Sending to %s failed: %s", user.id, exc)
            report.failed_deliveries.append(user.id)
            return
        report.emails_sent += 1
