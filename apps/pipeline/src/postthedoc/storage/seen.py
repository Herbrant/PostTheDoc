"""Registry of calls already seen, committed to the repository as data/seen.json.

Format (one call per line, so that daily commits have readable diffs):

    {"version": 2, "calls": {
    "mur-jobs-1": {"deadline": "2026-10-01T14:00:00+02:00", "first_seen": "2026-09-24T06:00:00Z"},
    ...
    },
    "retry": {
    "mur-jobs-2": "2026-09-24T06:00:00Z",
    ...
    }}

"retry" lists the calls that did not reach every matching user (a failed send, the provider's
daily quota) and since when: the next runs send them again to whoever is still missing them.
Version 1 files, a flat {id: deadline} object, and files without "retry" are still read.
"""

import json
import logging
import tempfile
from collections.abc import Collection, Iterable, Mapping
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import MappingProxyType

from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError

from postthedoc.models import Call

log = logging.getLogger(__name__)

VERSION = 2
# A call that expired longer ago than this will not show up among open calls again.
RETENTION = timedelta(days=60)
# Calls without a deadline are kept longer: forgetting one too early would notify it again.
UNDATED_RETENTION = timedelta(days=365)
# How long a call that did not reach every matching user is sent again: news gets stale, and a
# recipient that fails every day must not keep the job busy forever.
RETRY_WINDOW = timedelta(days=3)


class SeenError(Exception):
    """seen.json exists but cannot be read."""


class SeenEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    deadline: datetime | None
    first_seen: datetime


_ENTRIES = TypeAdapter(dict[str, SeenEntry])
_RETRIES = TypeAdapter(dict[str, datetime])
_TIME = TypeAdapter(datetime)
_LEGACY_ENTRIES = TypeAdapter(dict[str, datetime | None])


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
        if isinstance(data, dict) and data.get("version") == VERSION:
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
            self._entries[call.id] = SeenEntry(deadline=call.deadline, first_seen=first_seen)

    def prune(self, now: datetime) -> None:
        def keep(entry: SeenEntry) -> bool:
            if entry.deadline is None:
                return entry.first_seen >= now - UNDATED_RETENTION
            return entry.deadline >= now - RETENTION

        self._entries = {call_id: e for call_id, e in self._entries.items() if keep(e)}

    def save(self) -> None:
        """Write the file atomically: a crash midway leaves the previous version intact."""
        lines = [
            f"{json.dumps(call_id)}: {json.dumps(entry.model_dump(mode='json'))}"
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
