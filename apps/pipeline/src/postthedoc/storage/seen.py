"""Registry of calls already seen, committed to the repository as data/seen.json.

Format (one call per line, so that daily commits have readable diffs):

    {"version": 4, "calls": {
    "mur-jobs-1": {"deadline": "2026-10-01T14:00:00+02:00", "first_seen": "2026-09-24T06:00:00Z",
    "call": {"role": "researcher", "title": "...", "url": "https://bandi.mur.gov.it/...", ...},
    "changes": [{"at": "2026-09-25T06:00:00Z", "field": "deadline", "old": "...", "new": "..."}],
    "missing_since": "2026-09-26T06:00:00Z"},
    ...
    },
    "retry": {
    "mur-jobs-2": "2026-09-24T06:00:00Z",
    ...
    }}

"retry" lists the calls that did not reach every matching user (a failed send, the provider's
daily quota) and since when: the next runs send them again to whoever is still missing them.
"call" holds what the site shows of each call (the open calls page), as it is now; "changes" what
changed in it since it was first seen (deadline, title, positions, or a "status" going from
"open" to "withdrawn" and back), and "missing_since" when it went missing from the open calls,
until that is confirmed as a change. Both are left out when empty. Version 3 files, without them,
version 2 files, without "call", version 1 files, a flat {id: deadline} object, and files without
"retry" are still read.
"""

import json
import logging
import tempfile
from collections.abc import Collection, Iterable, Mapping
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from postthedoc.models import OPEN, WITHDRAWN, Call, CallChange

log = logging.getLogger(__name__)

VERSION = 4
# Versions read as they are: the missing "call" fields are filled in by describe().
READABLE_VERSIONS = (2, 3, 4)
# A call that expired longer ago than this will not show up among open calls again.
RETENTION = timedelta(days=60)
# Calls without a deadline are kept longer: forgetting one too early would notify it again.
UNDATED_RETENTION = timedelta(days=365)
# How long a call that did not reach every matching user is sent again: news gets stale, and a
# recipient that fails every day must not keep the job busy forever.
RETRY_WINDOW = timedelta(days=3)
# A call missing from the open calls counts as withdrawn only if still missing this much later
# (the next daily run): a page of the portal can be incomplete for a day.
WITHDRAWN_AFTER = timedelta(hours=12)
# Calls this close to their deadline may leave the open calls early (e.g. on their last day):
# not news.
WITHDRAWN_MARGIN = timedelta(hours=24)
# More calls than this going missing together from a part of the portal is the portal, not the
# institutions: their absence is ignored.
MAX_MISSING = 3
MAX_MISSING_SHARE = 0.25


class SeenError(Exception):
    """seen.json exists but cannot be read."""


class SeenCall(BaseModel):
    """The details of a call shown on the site: a subset of Call."""

    model_config = ConfigDict(frozen=True)

    role: str
    title: str
    url: str
    institution_name: str
    institution_code: str | None = None
    region: str | None = None
    gsd: list[str] = Field(default_factory=list)
    positions: int | None = None

    @classmethod
    def of(cls, call: Call) -> "SeenCall":
        return cls.model_validate(call.model_dump(include=set(cls.model_fields)))


class SeenEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    deadline: datetime | None
    first_seen: datetime
    call: SeenCall | None = None  # None in files written before version 3
    changes: tuple[CallChange, ...] = ()
    missing_since: datetime | None = None

    @property
    def withdrawn(self) -> bool:
        """Whether the call left the open calls before its deadline (and is still out)."""
        status = [c.new for c in self.changes if c.field == "status"]
        return bool(status) and status[-1] == WITHDRAWN


_ENTRIES = TypeAdapter(dict[str, SeenEntry])
_RETRIES = TypeAdapter(dict[str, datetime])
_TIME = TypeAdapter(datetime)
_LEGACY_ENTRIES = TypeAdapter(dict[str, datetime | None])


def _dump(entry: SeenEntry) -> dict[str, Any]:
    data = entry.model_dump(mode="json", include={"deadline", "first_seen"})
    if entry.call is not None:
        data["call"] = entry.call.model_dump(mode="json", exclude_none=True)
    if entry.changes:
        data["changes"] = [change.model_dump(mode="json") for change in entry.changes]
    if entry.missing_since is not None:
        data["missing_since"] = _TIME.dump_python(entry.missing_since, mode="json")
    return data


def _time(value: datetime) -> str:
    text: str = _TIME.dump_python(value, mode="json")
    return text


def _diff(entry: SeenEntry, seen: SeenCall, call: Call, now: datetime) -> list[CallChange]:
    """What changed in a call since the last run. Values missing on either side are not changes:
    the listings do not always show them."""
    changes = []
    if entry.deadline and call.deadline and entry.deadline != call.deadline:
        old, new = _time(entry.deadline), _time(call.deadline)
        changes.append(CallChange(at=now, field="deadline", old=old, new=new))
    if seen.title != call.title:
        changes.append(CallChange(at=now, field="title", old=seen.title, new=call.title))
    if seen.positions and call.positions and seen.positions != call.positions:
        changes.append(
            CallChange(at=now, field="positions", old=seen.positions, new=call.positions)
        )
    return changes


class SeenStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.exists = path.exists()
        self._entries: dict[str, SeenEntry] = {}
        self._retries: dict[str, datetime] = {}
        if self.exists:
            try:
                self._load()
            except (ValueError, KeyError, ValidationError) as exc:  # JSONDecodeError too
                raise SeenError(
                    f"{path} is corrupt ({type(exc).__name__}): restore it from git history"
                ) from exc

    def _load(self) -> None:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data.get("version") in READABLE_VERSIONS:
            self._entries = _ENTRIES.validate_python(data["calls"])
            self._retries = _RETRIES.validate_python(data.get("retry", {}))
            return
        log.info("Reading %s in the version 1 format", self.path)
        now = datetime.now(UTC)
        self._entries = {
            call_id: SeenEntry(deadline=deadline, first_seen=now)
            for call_id, deadline in _LEGACY_ENTRIES.validate_python(data).items()
        }

    def __contains__(self, call_id: object) -> bool:
        return call_id in self._entries

    def __len__(self) -> int:
        return len(self._entries)

    def entries(self) -> Mapping[str, SeenEntry]:
        return MappingProxyType(self._entries)

    def retries(self) -> Mapping[str, datetime]:
        """Calls to send again to whoever is still missing them, and since when."""
        return MappingProxyType(self._retries)

    def update_retries(
        self, done: Collection[str], undelivered: Iterable[str], now: datetime
    ) -> list[str]:
        """Record the outcome of a run: the `done` calls reached everyone, the `undelivered`
        ones did not. Return the calls given up on after RETRY_WINDOW."""
        missing = set(undelivered)
        retries = {c: since for c, since in self._retries.items() if c in missing or c not in done}
        for call_id in missing:
            retries.setdefault(call_id, now)
        expired = sorted(c for c, since in retries.items() if since < now - RETRY_WINDOW)
        self._retries = {c: since for c, since in retries.items() if c not in expired}
        return expired

    def add(self, calls: Iterable[Call], now: datetime) -> None:
        for call in calls:
            previous = self._entries.get(call.id)
            first_seen = previous.first_seen if previous else now
            self._entries[call.id] = SeenEntry(
                deadline=call.deadline, first_seen=first_seen, call=SeenCall.of(call)
            )

    def describe(self, calls: Iterable[Call]) -> None:
        """Fill in the details of the seen calls recorded without them (older files).

        Details already there are kept: calls are completed (e.g. their sector read from the
        detail page) only when new, so a later copy may lack what the first one had.
        """
        for call in calls:
            entry = self._entries.get(call.id)
            if entry is not None and entry.call is None:
                self._entries[call.id] = entry.model_copy(update={"call": SeenCall.of(call)})

    def observe(
        self, calls: Iterable[Call], scopes: Collection[str], now: datetime
    ) -> list[tuple[str, CallChange]]:
        """Compare the seen calls with today's open calls, record and return what changed.

        `scopes` are the id prefixes of the parts of the sources read in full today: a call
        missing from one of them is no longer open, while one missing elsewhere may just have
        been out of reach. Calls seen without details (older files) are left alone.
        """
        today = {call.id: call for call in calls}
        found: list[tuple[str, CallChange]] = []
        for call_id, call in today.items():
            entry = self._entries.get(call_id)
            if entry is None or entry.call is None:
                continue
            changes = _diff(entry, entry.call, call, now)
            if entry.withdrawn:
                changes.append(CallChange(at=now, field="status", old=WITHDRAWN, new=OPEN))
            if changes or entry.missing_since:
                self._entries[call_id] = entry.model_copy(
                    update={
                        "deadline": call.deadline or entry.deadline,
                        "call": entry.call.model_copy(
                            update={
                                "title": call.title,
                                "positions": call.positions or entry.call.positions,
                            }
                        ),
                        "changes": (*entry.changes, *changes),
                        "missing_since": None,
                    }
                )
            found.extend((call_id, change) for change in changes)
        for scope in scopes:
            found.extend(self._observe_missing(scope, today, now))
        return found

    def _observe_missing(
        self, scope: str, today: Mapping[str, Call], now: datetime
    ) -> list[tuple[str, CallChange]]:
        """Seen calls of `scope` still open but missing today: withdrawn, suspended or closed
        early, once still missing on a later run."""
        open_calls = [
            call_id
            for call_id, e in self._entries.items()
            if call_id.startswith(scope)
            and e.call is not None
            and not e.withdrawn
            and (e.deadline is None or e.deadline > now)
        ]
        missing = [
            call_id
            for call_id in open_calls
            if call_id not in today
            and (
                (deadline := self._entries[call_id].deadline) is None
                or deadline >= now + WITHDRAWN_MARGIN
            )
        ]
        if missing and (
            len(missing) == len(open_calls)
            or len(missing) > max(MAX_MISSING, MAX_MISSING_SHARE * len(open_calls))
        ):
            log.error(
                "%s: %d of %d open calls missing at once, ignored: is the portal incomplete?",
                scope,
                len(missing),
                len(open_calls),
            )
            return []
        found = []
        for call_id in missing:
            entry = self._entries[call_id]
            if entry.missing_since is None:
                self._entries[call_id] = entry.model_copy(update={"missing_since": now})
            elif entry.missing_since <= now - WITHDRAWN_AFTER:
                change = CallChange(at=now, field="status", old=OPEN, new=WITHDRAWN)
                self._entries[call_id] = entry.model_copy(
                    update={"changes": (*entry.changes, change), "missing_since": None}
                )
                found.append((call_id, change))
        return found

    def recent_changes(self, now: datetime) -> dict[str, list[CallChange]]:
        """The changes found within RETRY_WINDOW, by call: those to tell whoever got the call
        and was not told yet."""
        since = now - RETRY_WINDOW
        recent = {
            call_id: [c for c in entry.changes if c.at >= since]
            for call_id, entry in self._entries.items()
        }
        return {call_id: changes for call_id, changes in recent.items() if changes}

    def prune(self, now: datetime) -> None:
        def keep(entry: SeenEntry) -> bool:
            if entry.deadline is None:
                return entry.first_seen >= now - UNDATED_RETENTION
            return entry.deadline >= now - RETENTION

        self._entries = {call_id: e for call_id, e in self._entries.items() if keep(e)}

    def save(self) -> None:
        """Write the file atomically: a crash midway leaves the previous version intact."""
        lines = [
            f"{json.dumps(call_id)}: {json.dumps(_dump(entry), ensure_ascii=False)}"
            for call_id, entry in sorted(self._entries.items())
        ]
        retries = [
            f"{json.dumps(call_id)}: {json.dumps(_TIME.dump_python(since, mode='json'))}"
            for call_id, since in sorted(self._retries.items())
        ]
        text = (
            f'{{"version": {VERSION}, "calls": {{\n'
            + ",\n".join(lines)
            + '\n},\n"retry": {\n'
            + ",\n".join(retries)
            + "\n}}\n"
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=self.path.parent, prefix=".seen-", delete=False
        ) as tmp:
            tmp.write(text)
        Path(tmp.name).replace(self.path)
