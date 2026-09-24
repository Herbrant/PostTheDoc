import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import httpx

from postthedoc import tokens
from postthedoc.d1 import D1Client
from postthedoc.mailer import Email, render_digest
from postthedoc.matching import match_all
from postthedoc.models import Call, User
from postthedoc.sources import Source
from postthedoc.store import SeenStore

log = logging.getLogger(__name__)


class Mailer(Protocol):
    def send(self, email: Email) -> None: ...


@dataclass
class Settings:
    site_url: str  # frontend (GitHub Pages): preference management
    api_url: str  # Worker: one-click unsubscribe
    token_secret: str


@dataclass
class Report:
    fetched: int = 0
    new: int = 0
    emails_sent: int = 0
    failures: int = 0
    bootstrap: bool = False


def _links(user: User, settings: Settings) -> tuple[str, str]:
    site = settings.site_url.rstrip("/")
    api = settings.api_url.rstrip("/")
    manage = tokens.sign(settings.token_secret, "manage", user.id, user.token_version)
    unsub = tokens.sign(settings.token_secret, "unsubscribe", user.id, user.token_version)
    return f"{site}/{user.locale}/manage/#t={manage}", f"{api}/unsubscribe?t={unsub}"


def run(
    sources: list[Source],
    store: SeenStore,
    users: list[User],
    mailer: Mailer,
    settings: Settings,
    d1: D1Client | None = None,
    all_open: bool = False,
    now: datetime | None = None,
) -> Report:
    now = now or datetime.now(UTC)
    report = Report()

    calls = list({c.id: c for s in sources for c in s.fetch()}.values())
    report.fetched = len(calls)

    if not store.exists and not all_open:
        # First run: record the current state without mailing hundreds of already open calls.
        log.info("No seen.json: recording %d calls without sending notifications", len(calls))
        store.add(calls)
        report.bootstrap = True
        return report

    new: list[Call] = calls if all_open else [c for c in calls if c.id not in store]
    report.new = len(new)
    log.info("%d open calls, %d new", len(calls), len(new))
    for source in sources:
        source.enrich([c for c in new if c.source == source.name])

    matched = match_all(new, users)
    delivered = d1.delivered([c.id for c in new]) if d1 and new else set()

    for user in users:
        todo = [c for c in matched.get(user.id, []) if (user.id, c.id) not in delivered]
        if not todo:
            continue
        manage_url, unsubscribe_url = _links(user, settings)
        email = render_digest(todo, user.locale, manage_url, unsubscribe_url, now.date())
        email.to = user.email
        try:
            mailer.send(email)
            if d1:
                d1.record_deliveries(user.id, [c.id for c in todo])
        except (httpx.HTTPError, RuntimeError) as exc:
            log.error("Sending to %s failed: %s", user.id, exc)
            report.failures += 1
            continue
        report.emails_sent += 1

    store.add(new)
    store.prune(now)
    return report
