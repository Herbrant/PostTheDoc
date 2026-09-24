import logging
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import httpx
from jinja2 import Environment, PackageLoader, select_autoescape

from postthedoc import reference
from postthedoc.i18n import STRINGS
from postthedoc.models import Call, Locale

log = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"

_env = Environment(
    loader=PackageLoader("postthedoc", "templates"),
    autoescape=select_autoescape(["html.j2"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


@dataclass
class Email:
    to: str
    subject: str
    html: str
    text: str
    headers: dict[str, str] = field(default_factory=dict)


def render_digest(
    calls: list[Call], locale: Locale, manage_url: str, unsubscribe_url: str, today: date
) -> Email:
    t = STRINGS[locale]
    roles = reference.role_names(locale)
    order = list(roles)
    groups: dict[str, list[Call]] = {}
    for c in sorted(calls, key=lambda c: (order.index(c.role), c.deadline is None, c.deadline)):
        groups.setdefault(roles[c.role], []).append(c)

    day = f"{today:%d/%m/%Y}"
    count = len(calls)
    plural = "one" if count == 1 else "many"
    context = {
        "t": t,
        "locale": locale,
        "intro": t[f"intro_{plural}"].format(count=count, date=day),
        "groups": groups,
        "regions": reference.region_names(locale),
        "manage_url": manage_url,
        "unsubscribe_url": unsubscribe_url,
    }
    return Email(
        to="",
        subject=t[f"subject_{plural}"].format(count=count, date=day),
        html=_env.get_template("digest.html.j2").render(context),
        text=_env.get_template("digest.txt.j2").render(context),
        headers={
            "List-Unsubscribe": f"<{unsubscribe_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    )


class BrevoMailer:
    def __init__(self, client: httpx.Client, api_key: str, sender_email: str, sender_name: str):
        self.client = client
        self.api_key = api_key
        self.sender = {"email": sender_email, "name": sender_name}

    def send(self, email: Email) -> None:
        resp = self.client.post(
            BREVO_URL,
            headers={"api-key": self.api_key},
            json={
                "sender": self.sender,
                "to": [{"email": email.to}],
                "subject": email.subject,
                "htmlContent": email.html,
                "textContent": email.text,
                "headers": email.headers,
            },
        )
        resp.raise_for_status()


class FileMailer:
    """For --dry-run: write digests to disk instead of sending them."""

    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        out_dir.mkdir(parents=True, exist_ok=True)

    def send(self, email: Email) -> None:
        name = re.sub(r"[^\w.-]", "_", email.to)
        (self.out_dir / f"{name}.html").write_text(email.html, encoding="utf-8")
        (self.out_dir / f"{name}.txt").write_text(
            f"To: {email.to}\nSubject: {email.subject}\n\n{email.text}", encoding="utf-8"
        )
        log.info("Digest for %s written to %s", email.to, self.out_dir)
