"""Registry of calls already seen, committed to the repository as data/seen.json.

Format (one call per line, so that daily commits have readable diffs):

    {"version": 2, "calls": {
    "mur-jobs-1": {"deadline": "2026-10-01T14:00:00+02:00", "first_seen": "2026-09-24T06:00:00Z"},
    ...
    }}

Version 1 files, a flat {id: deadline} object, are still read.
"""

import json
import logging
import tempfile
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from pathlib import Path

from pydantic import BaseModel, ConfigDict, TypeAdapter

from postthedoc.models import Call

log = logging.getLogger(__name__)

VERSION = 2
# A call that expired longer ago than this will not show up among open calls again.
RETENTION = timedelta(days=60)
# Calls without a deadline are kept longer: forgetting one too early would notify it again.
UNDATED_RETENTION = timedelta(days=365)


class SeenEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    deadline: datetime | None
    first_seen: datetime


_ENTRIES = TypeAdapter(dict[str, SeenEntry])
_LEGACY_ENTRIES = TypeAdapter(dict[str, datetime | None])


class SeenStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.exists = path.exists()
        self._entries: dict[str, SeenEntry] = self._load() if self.exists else {}

    def _load(self) -> dict[str, SeenEntry]:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data.get("version") == VERSION:
            return _ENTRIES.validate_python(data["calls"])
        log.info("Reading %s in the version 1 format", self.path)
        now = datetime.now(UTC)
        return {
            call_id: SeenEntry(deadline=deadline, first_seen=now)
            for call_id, deadline in _LEGACY_ENTRIES.validate_python(data).items()
        }

    def __contains__(self, call_id: object) -> bool:
        return call_id in self._entries

    def __len__(self) -> int:
        return len(self._entries)

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
        text = f'{{"version": {VERSION}, "calls": {{\n' + ",\n".join(lines) + "\n}}\n"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=self.path.parent, prefix=".seen-", delete=False
        ) as tmp:
            tmp.write(text)
        Path(tmp.name).replace(self.path)
