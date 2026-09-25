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
    store.update_retries([], ["b", "c"], NOW)
    store.save()
    lines = (tmp_path / "seen.json").read_text().splitlines()
    assert len(lines) == 8
    assert lines[1].startswith('"a": {"deadline": ')
    assert lines[4:7] == [
        '"retry": {',
        '"b": "2026-09-24T06:00:00Z",',
        '"c": "2026-09-24T06:00:00Z"',
    ]


def test_retries_round_trip(tmp_path: Path):
    path = tmp_path / "seen.json"
    store = SeenStore(path)
    store.update_retries([], ["a"], NOW)
    store.save()
    assert SeenStore(path).retries() == {"a": NOW}


def test_reads_files_without_retries(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text('{"version": 2, "calls": {\n}}\n')
    assert SeenStore(path).retries() == {}


def test_retries_keep_their_start_and_expire():
    store = SeenStore(Path("/nonexistent/seen.json"))
    assert store.update_retries([], ["a", "b"], NOW) == []

    later = NOW + timedelta(days=2)
    assert store.update_retries(["b"], ["a", "c"], later) == []
    assert store.retries() == {"a": NOW, "c": later}  # b reached everyone

    assert store.update_retries([], ["a"], NOW + timedelta(days=3, seconds=1)) == ["a"]
    assert store.retries() == {"c": later}


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
