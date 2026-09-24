"""Registry of calls already seen, committed to the repo as data/seen.json."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from postthedoc.models import Call

# A call that expired longer ago than this will not show up among open calls again.
RETENTION = timedelta(days=60)


class SeenStore:
    def __init__(self, path: Path):
        self.path = path
        self.exists = path.exists()
        # id -> ISO deadline (None if unknown)
        self.entries: dict[str, str | None] = (
            json.loads(path.read_text(encoding="utf-8")) if self.exists else {}
        )

    def __contains__(self, call_id: str) -> bool:
        return call_id in self.entries

    def add(self, calls: list[Call]) -> None:
        for c in calls:
            self.entries[c.id] = c.deadline.isoformat() if c.deadline else None

    def prune(self, now: datetime) -> None:
        cutoff = now - RETENTION
        self.entries = {
            k: v
            for k, v in self.entries.items()
            if v is None or datetime.fromisoformat(v) >= cutoff
        }

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(dict(sorted(self.entries.items())), indent=0, ensure_ascii=False)
        self.path.write_text(text + "\n", encoding="utf-8")
