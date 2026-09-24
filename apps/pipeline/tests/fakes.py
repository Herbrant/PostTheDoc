"""In-memory stand-ins for the pipeline's collaborators."""

from collections.abc import Sequence

from postthedoc.mail import Email, MailError
from postthedoc.models import Call
from postthedoc.sources import FetchResult
from postthedoc.storage import D1Error


class FakeSource:
    name = "fake"

    def __init__(self, calls: Sequence[Call], failures: Sequence[str] = ()) -> None:
        self.calls = list(calls)
        self.failures = list(failures)
        self.enriched: list[str] = []

    def fetch(self) -> FetchResult:
        return FetchResult([c.model_copy() for c in self.calls], list(self.failures))

    def enrich(self, calls: Sequence[Call]) -> None:
        self.enriched.extend(c.id for c in calls)


class FakeMailer:
    def __init__(self, fail_for: frozenset[str] = frozenset()) -> None:
        self.sent: list[Email] = []
        self.fail_for = fail_for

    def send(self, email: Email) -> None:
        if email.to in self.fail_for:
            raise MailError("boom")
        self.sent.append(email)


class FakeDeliveryLog:
    def __init__(self, delivered: Sequence[tuple[str, str]] = (), failures: int = 0) -> None:
        self.rows = set(delivered)
        self.failures = failures  # how many record_deliveries calls fail before succeeding
        self.attempts = 0

    def delivered(self, call_ids: Sequence[str]) -> set[tuple[str, str]]:
        return {row for row in self.rows if row[1] in call_ids}

    def record_deliveries(self, user_id: str, call_ids: Sequence[str]) -> None:
        self.attempts += 1
        if self.attempts <= self.failures:
            raise D1Error("down")
        self.rows.update((user_id, c) for c in call_ids)
