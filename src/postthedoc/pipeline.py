import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import httpx

from postthedoc import tokens
from postthedoc.d1 import D1Client
from postthedoc.mailer import Email, render_digest
from postthedoc.matching import match_all
from postthedoc.models import Bando, User
from postthedoc.sources import Source
from postthedoc.store import SeenStore

log = logging.getLogger(__name__)


class Mailer(Protocol):
    def send(self, email: Email) -> None: ...


@dataclass
class Settings:
    site_url: str
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
    manage = tokens.sign(settings.token_secret, "manage", user.id, user.token_version)
    unsub = tokens.sign(settings.token_secret, "unsubscribe", user.id, user.token_version)
    return f"{site}/manage#t={manage}", f"{site}/unsubscribe?t={unsub}"


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

    bandi = list({b.id: b for s in sources for b in s.fetch()}.values())
    report.fetched = len(bandi)

    if not store.exists and not all_open:
        # Primo avvio: si registra lo stato attuale senza inviare centinaia di bandi già aperti.
        log.info("Nessun seen.json: registro %d bandi senza inviare notifiche", len(bandi))
        store.add(bandi)
        report.bootstrap = True
        return report

    new: list[Bando] = bandi if all_open else [b for b in bandi if b.id not in store]
    report.new = len(new)
    log.info("%d bandi aperti, %d nuovi", len(bandi), len(new))
    for source in sources:
        source.enrich([b for b in new if b.source == source.name])

    matched = match_all(new, users)
    delivered = d1.delivered([b.id for b in new]) if d1 and new else set()

    for user in users:
        todo = [b for b in matched.get(user.id, []) if (user.id, b.id) not in delivered]
        if not todo:
            continue
        manage_url, unsubscribe_url = _links(user, settings)
        email = render_digest(todo, manage_url, unsubscribe_url, now.date())
        email.to = user.email
        try:
            mailer.send(email)
            if d1:
                d1.record_deliveries(user.id, [b.id for b in todo])
        except (httpx.HTTPError, RuntimeError) as exc:
            log.error("Invio a %s fallito: %s", user.id, exc)
            report.failures += 1
            continue
        report.emails_sent += 1

    store.add(new)
    store.prune(now)
    return report
