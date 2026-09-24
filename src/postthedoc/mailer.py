import logging
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import httpx
from jinja2 import Environment, PackageLoader, select_autoescape

from postthedoc import reference
from postthedoc.models import Bando

log = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"

_env = Environment(
    loader=PackageLoader("postthedoc", "templates"),
    autoescape=select_autoescape(["html.j2"]),
    trim_blocks=True,
    lstrip_blocks=True,
)
_env.filters["date_it"] = lambda d: d.strftime("%d/%m/%Y %H:%M") if d else "n.d."


@dataclass
class Email:
    to: str
    subject: str
    html: str
    text: str
    headers: dict[str, str] = field(default_factory=dict)


def render_digest(bandi: list[Bando], manage_url: str, unsubscribe_url: str, today: date) -> Email:
    roles = reference.role_names()
    regions = reference.region_names()
    order = list(roles)
    groups: dict[str, list[Bando]] = {}
    for b in sorted(bandi, key=lambda b: (order.index(b.role), b.deadline is None, b.deadline)):
        groups.setdefault(roles[b.role], []).append(b)

    context = {
        "groups": groups,
        "regions": regions,
        "count": len(bandi),
        "today": today,
        "manage_url": manage_url,
        "unsubscribe_url": unsubscribe_url,
    }
    noun = "nuovo bando" if len(bandi) == 1 else "nuovi bandi"
    return Email(
        to="",
        subject=f"PostTheDoc: {len(bandi)} {noun} ({today:%d/%m/%Y})",
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
    """Per --dry-run: salva i digest su disco invece di inviarli."""

    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        out_dir.mkdir(parents=True, exist_ok=True)

    def send(self, email: Email) -> None:
        name = re.sub(r"[^\w.-]", "_", email.to)
        (self.out_dir / f"{name}.html").write_text(email.html, encoding="utf-8")
        (self.out_dir / f"{name}.txt").write_text(
            f"To: {email.to}\nSubject: {email.subject}\n\n{email.text}", encoding="utf-8"
        )
        log.info("Digest per %s salvato in %s", email.to, self.out_dir)
