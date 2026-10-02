"""The open dataset: CSV files, a Frictionless Data Package descriptor and a README, written from
the archive. The same archive and snapshot date always give the same files."""

import csv
import io
import json
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Any

from jinja2 import Environment, PackageLoader, StrictUndefined, select_autoescape

from postthedoc.archive import ArchivedCall
from postthedoc.config import REPOSITORY_URL
from postthedoc.dataset.checks import Review, unreviewed
from postthedoc.models import CallChange, is_withdrawn
from postthedoc.reference import ReferenceData

SOURCE_URL = "https://bandi.mur.gov.it"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
OMITTED_TITLE = "[omesso / omitted]"


class PersonalDataError(Exception):
    """Some titles may hold personal data and nobody reviewed them yet."""

    def __init__(self, flagged: Mapping[str, list[str]]) -> None:
        self.flagged = dict(flagged)
        listed = ", ".join(f"{call_id} ({'/'.join(why)})" for call_id, why in flagged.items())
        super().__init__(
            f"Titles that may hold personal data: {listed}. Review them in "
            "data/archive/reviewed.json (keep or omit-title)."
        )


@dataclass(frozen=True)
class Field:
    name: str
    type: str  # Table Schema type
    description: str
    origin: str  # "source": as published on the portal; "derived": computed by PostTheDoc


SOURCE, DERIVED = "source", "derived"

CALL_FIELDS = (
    Field("id", "string", "PostTheDoc id: mur-<section>-<portal id>", DERIVED),
    Field("section", "string", "Section of bandi.mur.gov.it the call is listed in", SOURCE),
    Field("role", "string", "Kind of position, see roles.csv", DERIVED),
    Field("title", "string", "Title of the call", SOURCE),
    Field("url", "string", "Page of the call on bandi.mur.gov.it", SOURCE),
    Field("institution_name", "string", "Institution, as written on the portal", SOURCE),
    Field("institution_code", "string", "MUR code of the institution, when recognized", DERIVED),
    Field("region", "string", "ISO 3166-2 region of the institution, see regions.csv", DERIVED),
    Field("gsd", "string", "Scientific sector groups (G.S.D.), separated by ';'", SOURCE),
    Field("positions", "integer", "Number of positions, when stated", SOURCE),
    Field("published", "date", 'Date of the call ("Data del bando"), when read', SOURCE),
    Field("deadline", "datetime", "Application deadline (Italian time)", SOURCE),
    Field("first_seen", "datetime", "When PostTheDoc first found the call open (UTC)", DERIVED),
    Field(
        "status",
        "string",
        "On the snapshot date: open, closed (deadline passed) or withdrawn (left the open calls"
        " before its deadline)",
        DERIVED,
    ),
    Field("changes", "integer", "Number of changes recorded, see changes.csv", DERIVED),
)
CHANGE_FIELDS = (
    Field("call_id", "string", "The call, see calls.csv", DERIVED),
    Field("at", "datetime", "When PostTheDoc found the change (UTC)", DERIVED),
    Field("field", "string", "deadline, title, positions or status", DERIVED),
    Field("old", "string", "Value before the change", SOURCE),
    Field("new", "string", "Value after the change", SOURCE),
)
ROLE_FIELDS = (
    Field("code", "string", "Role code used in calls.csv", DERIVED),
    Field("name_it", "string", "Name in Italian", DERIVED),
    Field("name_en", "string", "Name in English", DERIVED),
)
REGION_FIELDS = (
    Field("code", "string", "ISO 3166-2 code", DERIVED),
    Field("name_it", "string", "Name in Italian", DERIVED),
    Field("name_en", "string", "Name in English", DERIVED),
)


def _status(call: ArchivedCall, changes: Sequence[CallChange], snapshot: datetime) -> str:
    if is_withdrawn(changes):
        return "withdrawn"
    if call.deadline is not None and call.deadline < snapshot:
        return "closed"
    return "open"


def _time(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def _csv(fields: Sequence[Field], rows: Iterable[Sequence[object]]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(f.name for f in fields)
    writer.writerows(["" if value is None else value for value in row] for row in rows)
    return out.getvalue()


def _schema(fields: Sequence[Field]) -> dict[str, Any]:
    columns = []
    for f in fields:
        column = {"name": f.name, "type": f.type, "description": f.description, "origin": f.origin}
        if f.type == "datetime":
            column["format"] = "any"  # ISO 8601 with offset, not only the default UTC form
        columns.append(column)
    return {"fields": columns, "missingValues": [""]}


class Dataset:
    def __init__(self, reference: ReferenceData) -> None:
        self._reference = reference
        self._env = Environment(
            loader=PackageLoader("postthedoc.dataset", "templates"),
            autoescape=select_autoescape(["html"]),  # Markdown and plain text: nothing to escape
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True,
        )

    def export(
        self,
        calls: Iterable[ArchivedCall],
        reviews: Mapping[str, Review],
        out: Path,
        snapshot: date,
    ) -> list[Path]:
        """Write the dataset to `out` as of the start of `snapshot` (UTC); return the files.

        Raise PersonalDataError if some titles may hold personal data and were not reviewed.
        """
        calls = sorted(calls, key=lambda call: call.id)
        if flagged := unreviewed(calls, reviews):
            raise PersonalDataError(flagged)
        # What was found before the snapshot: a past date leaves out later calls and changes
        # (the details of a call are the latest, though).
        moment = datetime.combine(snapshot, time(), UTC)
        calls = [c for c in calls if c.first_seen < moment]
        found = {call.id: [c for c in call.changes if c.at < moment] for call in calls}
        statuses = {call.id: _status(call, found[call.id], moment) for call in calls}
        changes = [(call.id, change) for call in calls for change in found[call.id]]
        files = {
            "calls.csv": _csv(
                CALL_FIELDS,
                (
                    (
                        call.id,
                        call.id.split("-")[1],
                        call.role,
                        OMITTED_TITLE if reviews.get(call.id) == "omit-title" else call.title,
                        call.url,
                        call.institution_name,
                        call.institution_code,
                        call.region,
                        ";".join(call.gsd),
                        call.positions,
                        call.published.isoformat() if call.published else "",
                        _time(call.deadline),
                        _time(call.first_seen),
                        statuses[call.id],
                        len(found[call.id]),
                    )
                    for call in calls
                ),
            ),
            "changes.csv": _csv(
                CHANGE_FIELDS,
                (
                    (call_id, _time(c.at), c.field, *self._values(call_id, c.old, c.new, reviews))
                    for call_id, c in changes
                ),
            ),
            "roles.csv": _csv(
                ROLE_FIELDS,
                ((role.code, role.name.it, role.name.en) for role in self._reference.roles),
            ),
            "regions.csv": _csv(
                REGION_FIELDS,
                ((r.code, r.name.it, r.name.en) for r in self._reference.regions),
            ),
        }
        summary = {
            "snapshot": snapshot.isoformat(),
            "calls": len(calls),
            "changes": len(changes),
            "open": sum(1 for s in statuses.values() if s == "open"),
            "withdrawn": sum(1 for s in statuses.values() if s == "withdrawn"),
            "since": min((c.first_seen for c in calls), default=moment).date().isoformat(),
            "source_url": SOURCE_URL,
            "license_url": LICENSE_URL,
            "repository_url": REPOSITORY_URL,
        }
        files["datapackage.json"] = json.dumps(self._descriptor(summary), indent=2) + "\n"
        files["README.md"] = self._env.get_template("README.md.j2").render(summary)
        files["LICENSE"] = self._env.get_template("LICENSE.j2").render(summary)

        out.mkdir(parents=True, exist_ok=True)
        written = []
        for name, text in files.items():
            path = out / name
            path.write_text(text, encoding="utf-8")
            written.append(path)
        return written

    @staticmethod
    def _values(
        call_id: str, old: object, new: object, reviews: Mapping[str, Review]
    ) -> tuple[object, object]:
        # An omitted title must not come back through its changes.
        if reviews.get(call_id) == "omit-title" and isinstance(old, str) and isinstance(new, str):
            return OMITTED_TITLE, OMITTED_TITLE
        return old, new

    @staticmethod
    def _descriptor(summary: Mapping[str, object]) -> dict[str, Any]:
        def resource(name: str, fields: Sequence[Field], **extra: object) -> dict[str, Any]:
            return {
                "name": name,
                "path": f"{name}.csv",
                "format": "csv",
                "mediatype": "text/csv",
                "encoding": "utf-8",
                "schema": _schema(fields) | extra,
            }

        return {
            "name": "postthedoc-mur-calls",
            "title": "PostTheDoc: Italian academic job calls from bandi.mur.gov.it",
            "description": "Calls for PhDs, research fellowships and contracts, researcher, "
            "technologist and professor positions published on bandi.mur.gov.it, as collected "
            "every day by PostTheDoc, with the changes found in them. Field 'origin' tells "
            "values as published (source) from values computed by PostTheDoc (derived).",
            "version": summary["snapshot"],
            "created": f"{summary['snapshot']}T00:00:00Z",
            "homepage": summary["repository_url"],
            "licenses": [
                {
                    "name": "CC-BY-4.0",
                    "title": "Creative Commons Attribution 4.0",
                    "path": LICENSE_URL,
                }
            ],
            "sources": [{"title": "MUR / Cineca - bandi.mur.gov.it", "path": SOURCE_URL}],
            "contributors": [{"title": "PostTheDoc", "path": REPOSITORY_URL, "role": "author"}],
            "resources": [
                resource(
                    "calls",
                    CALL_FIELDS,
                    primaryKey=["id"],
                    foreignKeys=[
                        {"fields": "role", "reference": {"resource": "roles", "fields": "code"}},
                        {
                            "fields": "region",
                            "reference": {"resource": "regions", "fields": "code"},
                        },
                    ],
                ),
                resource(
                    "changes",
                    CHANGE_FIELDS,
                    foreignKeys=[
                        {"fields": "call_id", "reference": {"resource": "calls", "fields": "id"}}
                    ],
                ),
                resource("roles", ROLE_FIELDS, primaryKey=["code"]),
                resource("regions", REGION_FIELDS, primaryKey=["code"]),
            ],
        }
