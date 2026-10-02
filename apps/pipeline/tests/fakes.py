"""In-memory stand-ins for the pipeline's collaborators."""

from collections.abc import Callable, Sequence
from datetime import date, datetime, timedelta

from postthedoc.mail import Email, MailError, MailerUnavailableError
from postthedoc.models import Call
from postthedoc.sources import FetchResult
from postthedoc.storage import D1Error
from tests.factories import NOW


class FakeSource:
    name = "fake"

    def __init__(
        self,
        calls: Sequence[Call],
        failures: Sequence[str] = (),
        incomplete: Sequence[str] = (),
        scopes: Sequence[str] = (),
        published: date | None = None,
    ) -> None:
        self.calls = list(calls)
        self.failures = list(failures)
        self.incomplete = set(incomplete)
        self.scopes = list(scopes)  # none by default: missing calls are not looked at
        self.published = published  # the date the detail pages give every call
        self.enriched: list[str] = []

    def fetch(self) -> FetchResult:
        return FetchResult(
            [c.model_copy() for c in self.calls], list(self.failures), list(self.scopes)
        )

    def enrich(self, calls: Sequence[Call]) -> list[str]:
        self.enriched.extend(c.id for c in calls)
        for call in calls:
            if call.id not in self.incomplete:
                call.published, call.details = self.published, True
        return [c.id for c in calls if c.id in self.incomplete]


class FakeMailer:
    def __init__(self, fail_for: frozenset[str] = frozenset()) -> None:
        self.sent: list[Email] = []
        self.fail_for = fail_for

    def send(self, email: Email) -> None:
        if email.to in self.fail_for:
            raise MailError("boom")
        self.sent.append(email)


class QuotaMailer:
    """A provider whose daily quota is used up."""

    def __init__(self) -> None:
        self.attempts = 0

    def send(self, email: Email) -> None:
        self.attempts += 1
        raise MailerUnavailableError("quota")


class FakeDeliveryLog:
    def __init__(
        self,
        delivered: Sequence[tuple[str, str]] = (),
        failures: int = 0,
        clock: Callable[[], datetime] = lambda: NOW,
        updates_down: bool = False,
    ) -> None:
        # Deliveries given upfront were sent a while ago.
        self.times = dict.fromkeys(delivered, NOW - timedelta(days=30))
        self.failures = failures  # how many record_deliveries calls fail before succeeding
        self.attempts = 0
        self.clock = clock  # when the deliveries recorded now are sent
        self.updates: set[tuple[str, str, datetime]] = set()
        self.updates_down = updates_down  # the call_updates table is missing

    @property
    def rows(self) -> set[tuple[str, str]]:
        return set(self.times)

    def delivered(self, call_ids: Sequence[str]) -> set[tuple[str, str]]:
        return {row for row in self.times if row[1] in call_ids}

    def delivery_times(self, call_ids: Sequence[str]) -> dict[tuple[str, str], datetime]:
        return {row: sent for row, sent in self.times.items() if row[1] in call_ids}

    def record_deliveries(self, user_id: str, call_ids: Sequence[str]) -> None:
        self.attempts += 1
        if self.attempts <= self.failures:
            raise D1Error("down")
        for call_id in call_ids:
            self.times.setdefault((user_id, call_id), self.clock())

    def updates_sent(self, call_ids: Sequence[str]) -> set[tuple[str, str, datetime]]:
        if self.updates_down:
            raise D1Error("no such table: call_updates")
        return {row for row in self.updates if row[1] in call_ids}

    def record_updates(self, user_id: str, changes: Sequence[tuple[str, datetime]]) -> None:
        if self.updates_down:
            raise D1Error("no such table: call_updates")
        self.updates.update((user_id, call_id, at) for call_id, at in changes)
