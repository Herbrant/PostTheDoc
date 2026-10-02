"""Rendering of the daily digest (HTML and plain text) from Jinja templates."""

from collections.abc import Sequence
from datetime import date, datetime

from jinja2 import Environment, PackageLoader, StrictUndefined, select_autoescape

from postthedoc.contract import Locale
from postthedoc.digest.strings import STRINGS, DigestStrings
from postthedoc.links import DigestLinks
from postthedoc.mail import Email
from postthedoc.models import WITHDRAWN, Call, CallChange, CallUpdate
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
        self,
        to: str,
        calls: Sequence[Call],
        locale: Locale,
        links: DigestLinks,
        today: date,
        updates: Sequence[CallUpdate] = (),
    ) -> Email:
        """The digest of the new `calls` and of the `updates` to calls sent before."""
        t = STRINGS[locale]
        day = f"{today:%d/%m/%Y}"
        new = _plural(t["new_one"], t["new_many"], len(calls))
        updated = _plural(t["updated_one"], t["updated_many"], len(updates))
        if calls and updates:
            summary = t["new_and_updated"].format(new=new, updated=updated)
        else:
            summary = new if calls else updated
        if calls:
            intro = _plural(t["intro_one"], t["intro_many"], len(calls), date=day)
        else:
            intro = _plural(t["intro_updates_one"], t["intro_updates_many"], len(updates), date=day)
        context = {
            "t": t,
            "locale": locale,
            "intro": intro,
            "groups": self._group_by_role(calls, locale),
            "updates": [(u, [_describe(c, t) for c in u.changes]) for u in updates],
            "regions": self._reference.region_names(locale),
            "links": links,
        }
        return Email(
            to=to,
            subject=t["subject"].format(summary=summary, date=day),
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


def _plural(one: str, many: str, count: int, **values: str) -> str:
    return (one if count == 1 else many).format(count=count, **values)


def _deadline(value: str | int | None) -> str:
    return f"{datetime.fromisoformat(str(value)):%d/%m/%Y %H:%M}"


def _describe(change: CallChange, t: DigestStrings) -> str:
    """One line about a change to a call, in the reader's language."""
    match change.field:
        case "deadline":
            extended = datetime.fromisoformat(str(change.new)) > datetime.fromisoformat(
                str(change.old)
            )
            line = t["change_deadline_extended" if extended else "change_deadline_brought_forward"]
            return line.format(old=_deadline(change.old), new=_deadline(change.new))
        case "title":
            return t["change_title"].format(old=change.old)
        case "positions":
            return t["change_positions"].format(old=change.old, new=change.new)
        case "status":
            return t["change_withdrawn" if change.new == WITHDRAWN else "change_reopened"]
