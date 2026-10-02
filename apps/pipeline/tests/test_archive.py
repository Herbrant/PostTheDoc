import json
from datetime import timedelta
from pathlib import Path

import pytest

from postthedoc.archive import ArchiveError, ArchiveStore
from postthedoc.storage import SeenStore
from tests.factories import NOW, make_call


def seen_with(path: Path, *calls) -> SeenStore:
    store = SeenStore(path / "seen.json")
    store.add(calls, NOW)
    return store


def test_merge_adds_and_updates_the_calls(tmp_path: Path):
    store = seen_with(tmp_path, make_call("mur-jobs-1"), make_call("mur-jobs-2", deadline=None))
    archive = ArchiveStore(tmp_path / "archive" / "calls.jsonl")

    assert archive.merge(store.entries()) == 2
    assert archive.merge(store.entries()) == 0  # nothing new

    store.observe([make_call("mur-jobs-1", title="Rettifica")], [], NOW + timedelta(days=1))
    assert archive.merge(store.entries()) == 1
    [first, second] = archive
    assert (first.id, first.title, len(first.changes)) == ("mur-jobs-1", "Rettifica", 1)
    assert second.deadline is None


def test_calls_stay_after_seen_forgets_them(tmp_path: Path):
    store = seen_with(tmp_path, make_call("mur-jobs-1", deadline=NOW))
    archive = ArchiveStore(tmp_path / "calls.jsonl")
    archive.merge(store.entries())

    store.prune(NOW + timedelta(days=365))
    archive.merge(store.entries())

    assert len(store) == 0
    assert [call.id for call in archive] == ["mur-jobs-1"]


def test_calls_without_details_are_left_out(tmp_path: Path):
    (tmp_path / "seen.json").write_text(
        '{"version": 2, "calls": {\n'
        '"mur-jobs-1": {"deadline": null, "first_seen": "2026-09-24T06:00:00Z"}\n'
        "}}\n"
    )
    archive = ArchiveStore(tmp_path / "calls.jsonl")
    assert archive.merge(SeenStore(tmp_path / "seen.json").entries()) == 0


def test_round_trip_one_call_per_line(tmp_path: Path):
    store = seen_with(tmp_path, make_call("mur-jobs-2", deadline=None), make_call("mur-jobs-1"))
    store.observe([make_call("mur-jobs-1", positions=3), make_call("mur-jobs-2")], [], NOW)
    store.observe([make_call("mur-jobs-1", title="New")], [], NOW + timedelta(days=1))
    path = tmp_path / "calls.jsonl"
    archive = ArchiveStore(path)
    archive.merge(store.entries())
    archive.save()

    lines = path.read_text().splitlines()
    assert [json.loads(line)["id"] for line in lines] == ["mur-jobs-1", "mur-jobs-2"]
    assert lines[0].startswith('{"id": "mur-jobs-1", "deadline": "2026-10-04T06:00:00Z"')
    assert '"changes": [{"at": "2026-09-25T06:00:00Z", "field": "title"' in lines[0]
    assert lines[1].startswith('{"id": "mur-jobs-2", "deadline": null, "first_seen": ')
    assert "changes" not in lines[1]
    assert list(ArchiveStore(path)) == list(archive)
    assert not list(tmp_path.glob(".archive-*"))


def test_corrupt_archive_raises_a_clear_error(tmp_path: Path):
    path = tmp_path / "calls.jsonl"
    path.write_text('{"id": "mur-jobs-1"}\n')
    with pytest.raises(ArchiveError, match="line 1"):
        ArchiveStore(path)
