"""Registro dei bandi già visti, committato nel repo come data/seen.json."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from postthedoc.models import Bando

# Un bando scaduto da più di così non ricomparirà tra gli aperti: lo si può dimenticare.
RETENTION = timedelta(days=60)


class SeenStore:
    def __init__(self, path: Path):
        self.path = path
        self.exists = path.exists()
        # id -> scadenza ISO (o None se sconosciuta)
        self.entries: dict[str, str | None] = (
            json.loads(path.read_text(encoding="utf-8")) if self.exists else {}
        )

    def __contains__(self, bando_id: str) -> bool:
        return bando_id in self.entries

    def add(self, bandi: list[Bando]) -> None:
        for b in bandi:
            self.entries[b.id] = b.deadline.isoformat() if b.deadline else None

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
