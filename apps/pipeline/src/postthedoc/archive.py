"""Permanent archive of every call seen, committed to the repository as data/archive/calls.jsonl.

seen.json forgets a call a while after it closes (storage/seen.py, RETENTION); the archive keeps
it, with its changes, for the open dataset (postthedoc.dataset). One call per line, by id, so
that the daily commits have readable diffs:

    {"id": "mur-jobs-1", "deadline": "...", "first_seen": "...", "role": "researcher", ...,
     "changes": [...]}

Records are updated from seen.json while it still knows their call, and never deleted.
"""

import json
import tempfile
from collections.abc import Iterator, Mapping
from datetime import datetime
from pathlib import Path

from pydantic import ConfigDict, ValidationError

from postthedoc.models import CallChange
from postthedoc.storage.seen import SeenCall, SeenEntry

# Order of the keys on each line: identity and dates first, then the details, then the changes.
_KEYS = ("id", "deadline", "first_seen", *SeenCall.model_fields, "changes")


class ArchiveError(Exception):
    """The archive exists but cannot be read."""


class ArchivedCall(SeenCall):
    model_config = ConfigDict(frozen=True)

    id: str
    deadline: datetime | None
    first_seen: datetime
    changes: tuple[CallChange, ...] = ()


def _dump(call: ArchivedCall) -> str:
    data = call.model_dump(mode="json", exclude_none=True)
    data["deadline"] = data.get("deadline")  # kept even when null, as in seen.json
    if not call.changes:
        del data["changes"]
    return json.dumps({key: data[key] for key in _KEYS if key in data}, ensure_ascii=False)


class ArchiveStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._calls: dict[str, ArchivedCall] = {}
        if not path.exists():
            return
        lines = path.read_text(encoding="utf-8").splitlines()
        for number, line in enumerate(lines, 1):
            try:
                call = ArchivedCall.model_validate_json(line)
            except ValidationError as exc:
                raise ArchiveError(
                    f"{path} is corrupt (line {number}): restore it from git history"
                ) from exc
            self._calls[call.id] = call

    def __len__(self) -> int:
        return len(self._calls)

    def __iter__(self) -> Iterator[ArchivedCall]:
        return iter(sorted(self._calls.values(), key=lambda call: call.id))

    def merge(self, entries: Mapping[str, SeenEntry]) -> int:
        """Add or update the calls seen.json has the details of; return how many changed."""
        changed = 0
        for call_id, entry in entries.items():
            if entry.call is None:
                continue  # recorded before seen.json kept details: nothing to archive
            call = ArchivedCall(
                id=call_id,
                deadline=entry.deadline,
                first_seen=entry.first_seen,
                changes=entry.changes,
                **entry.call.model_dump(),
            )
            if self._calls.get(call_id) != call:
                self._calls[call_id] = call
                changed += 1
        return changed

    def save(self) -> None:
        """Write the file atomically: a crash midway leaves the previous version intact."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=self.path.parent, prefix=".archive-", delete=False
        ) as tmp:
            tmp.write("".join(f"{_dump(call)}\n" for call in self))
        Path(tmp.name).replace(self.path)
