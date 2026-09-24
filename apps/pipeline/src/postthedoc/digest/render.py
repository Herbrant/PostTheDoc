"""Rendering of the daily digest (HTML and plain text) from Jinja templates."""

from collections.abc import Sequence
from datetime import date

from jinja2 import Environment, PackageLoader, StrictUndefined, select_autoescape

from postthedoc.contract import Locale
from postthedoc.digest.strings import STRINGS
from postthedoc.links import DigestLinks
from postthedoc.mail import Email
from postthedoc.models import Call
from postthedoc.reference import ReferenceData


class DigestRenderer:
    def __init__(self, reference: ReferenceData) -> None:
        self._reference = reference
        self._env = Environment(
            loader=PackageLoader("postthedoc.digest", "templates"),
            autoescape=select_autoescape(["html.j2"]),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(
        self, to: str, calls: Sequence[Call], locale: Locale, links: DigestLinks, today: date
    ) -> Email:
        t = STRINGS[locale]
        count = len(calls)
        day = f"{today:%d/%m/%Y}"
        subject, intro = (
            (t["subject_one"], t["intro_one"])
            if count == 1
            else (t["subject_many"], t["intro_many"])
        )
        context = {
            "t": t,
            "locale": locale,
            "intro": intro.format(count=count, date=day),
            "groups": self._group_by_role(calls, locale),
            "regions": self._reference.region_names(locale),
            "links": links,
        }
        return Email(
            to=to,
            subject=subject.format(count=count, date=day),
            html=self._env.get_template("digest.html.j2").render(context),
            text=self._env.get_template("digest.txt.j2").render(context),
            headers={
                "List-Unsubscribe": f"<{links.unsubscribe}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        )

    def _group_by_role(self, calls: Sequence[Call], locale: Locale) -> dict[str, list[Call]]:
        """Localized role name -> its calls, in the roles' display order, earliest deadline first.

        Roles missing from roles.json (the reference data is behind the scraper) come last, under
        their code, rather than breaking the digest.
        """
        names = self._reference.role_names(locale)
        order = {code: i for i, code in enumerate(names)}

        def key(call: Call) -> tuple[int, bool, float]:
            deadline = call.deadline.timestamp() if call.deadline else 0.0
            return order.get(call.role, len(order)), call.deadline is None, deadline

        groups: dict[str, list[Call]] = {}
        for call in sorted(calls, key=key):
            groups.setdefault(names.get(call.role, call.role), []).append(call)
        return groups
