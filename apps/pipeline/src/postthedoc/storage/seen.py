"""Registry of calls already seen, committed to the repository as data/seen.json."""

import json
from collections.abc import Iterable
from datetime import datetime, timedelta
from pathlib import Path

from postthedoc.models import Call

# A call that expired longer ago than this will not show up among open calls again.
RETENTION = timedelta(days=60)


class SeenStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.exists = path.exists()
        # id -> ISO deadline (None if unknown)
        self._entries: dict[str, str | None] = (
            json.loads(path.read_text(encoding="utf-8")) if self.exists else {}
        )

    def __contains__(self, call_id: object) -> bool:
        return call_id in self._entries

    def __len__(self) -> int:
        return len(self._entries)

    def add(self, calls: Iterable[Call]) -> None:
        for call in calls:
            self._entries[call.id] = call.deadline.isoformat() if call.deadline else None

    def prune(self, now: datetime) -> None:
        cutoff = now - RETENTION
        self._entries = {
            call_id: deadline
            for call_id, deadline in self._entries.items()
            if deadline is None or datetime.fromisoformat(deadline) >= cutoff
        }

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(dict(sorted(self._entries.items())), indent=0, ensure_ascii=False)
        self.path.write_text(text + "\n", encoding="utf-8")
