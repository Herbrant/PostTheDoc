import json
from datetime import timedelta
from pathlib import Path

import pytest

from postthedoc.storage import SeenStore
from tests.factories import NOW, make_call


def test_round_trip(tmp_path: Path):
    path = tmp_path / "data" / "seen.json"
    store = SeenStore(path)
    assert not store.exists
    store.add([make_call("a"), make_call("b", deadline=None)], NOW)
    store.save()

    reloaded = SeenStore(path)
    assert reloaded.exists
    assert "a" in reloaded
    assert "b" in reloaded
    assert len(reloaded) == 2
    assert json.loads(path.read_text())["version"] == 2


def test_one_call_per_line(tmp_path: Path):
    store = SeenStore(tmp_path / "seen.json")
    store.add([make_call("a"), make_call("b")], NOW)
    store.save()
    lines = (tmp_path / "seen.json").read_text().splitlines()
    assert len(lines) == 4
    assert lines[1].startswith('"a": {"deadline": ')


def test_save_leaves_no_temporary_files(tmp_path: Path):
    store = SeenStore(tmp_path / "seen.json")
    store.add([make_call("a")], NOW)
    store.save()
    store.save()
    assert [p.name for p in tmp_path.iterdir()] == ["seen.json"]


def test_reads_the_version_1_format(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text('{\n"a": "2026-10-01T14:00:00+02:00",\n"b": null\n}\n')
    store = SeenStore(path)
    assert "a" in store
    assert "b" in store


def test_first_seen_survives_updates(tmp_path: Path):
    path = tmp_path / "seen.json"
    store = SeenStore(path)
    store.add([make_call("a", deadline=None)], NOW)
    store.add([make_call("a", deadline=None)], NOW + timedelta(days=400))
    store.prune(NOW + timedelta(days=400))
    assert "a" not in store  # first seen more than a year before


@pytest.mark.parametrize(
    ("deadline", "age", "kept"),
    [
        (NOW - timedelta(days=90), timedelta(0), False),
        (NOW - timedelta(days=30), timedelta(0), True),
        (None, timedelta(days=100), True),
        (None, timedelta(days=400), False),
    ],
)
def test_prune(tmp_path: Path, deadline, age, kept):
    store = SeenStore(tmp_path / "seen.json")
    store.add([make_call("a", deadline=deadline)], NOW - age)
    store.prune(NOW)
    assert ("a" in store) is kept
