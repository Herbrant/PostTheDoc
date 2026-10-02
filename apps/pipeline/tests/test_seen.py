import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from postthedoc.models import CallChange
from postthedoc.storage import SeenError, SeenStore
from postthedoc.storage.seen import SeenCall
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
    assert json.loads(path.read_text())["version"] == 4
    assert reloaded.entries()["a"].call == SeenCall.of(make_call("a"))


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


def test_corrupt_files_raise_a_clear_error(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text('{"version": 2, "calls": {"a": {"deadline": ')
    with pytest.raises(SeenError, match="restore it from git history"):
        SeenStore(path)


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


def test_details_are_written_compactly(tmp_path: Path):
    store = SeenStore(tmp_path / "seen.json")
    store.add([make_call("a", title="Università di Catania", positions=None)], NOW)
    store.save()
    line = (tmp_path / "seen.json").read_text().splitlines()[1]
    assert '"title": "Università di Catania"' in line
    assert "positions" not in line


def test_reads_version_2_files_without_details(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text(
        '{"version": 2, "calls": {\n'
        '"a": {"deadline": null, "first_seen": "2026-09-24T06:00:00Z"}\n'
        "}}\n"
    )
    store = SeenStore(path)
    assert store.entries()["a"].call is None
    assert store.entries()["a"].first_seen == NOW


def test_describe_fills_in_only_missing_details(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text(
        '{"version": 2, "calls": {\n'
        '"a": {"deadline": null, "first_seen": "2026-09-24T06:00:00Z"}\n'
        "}}\n"
    )
    store = SeenStore(path)
    store.add([make_call("b")], NOW)
    store.describe([make_call("a", gsd=[]), make_call("b", gsd=[]), make_call("c")])

    entries = store.entries()
    assert entries["a"].call == SeenCall.of(make_call("a", gsd=[]))
    assert entries["a"].first_seen == NOW
    assert entries["b"].call is not None
    assert entries["b"].call.gsd == ["INFO-01"]  # kept: later copies are not enriched
    assert "c" not in store  # describing does not add calls


SCOPE = "mur-jobs-"
LATER = NOW + timedelta(days=1)


def seen(*calls) -> SeenStore:
    store = SeenStore(Path("/nonexistent/seen.json"))
    store.add(calls, NOW)
    return store


def test_reads_version_3_files(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text(
        '{"version": 3, "calls": {\n'
        '"a": {"deadline": null, "first_seen": "2026-09-24T06:00:00Z", "call": {"role": "phd",'
        ' "title": "T", "url": "https://example.org/a", "institution_name": "I"}}\n'
        "}}\n"
    )
    entry = SeenStore(path).entries()["a"]
    assert entry.changes == ()
    assert entry.missing_since is None


def test_observe_records_and_applies_changes():
    store = seen(make_call("mur-jobs-1", positions=1))
    today = make_call(
        "mur-jobs-1", deadline=NOW + timedelta(days=20), title="Rettifica", positions=2
    )

    changes = store.observe([today], [SCOPE], LATER)

    old = (NOW + timedelta(days=10)).isoformat().replace("+00:00", "Z")
    new = (NOW + timedelta(days=20)).isoformat().replace("+00:00", "Z")
    assert changes == [
        ("mur-jobs-1", CallChange(at=LATER, field="deadline", old=old, new=new)),
        ("mur-jobs-1", CallChange(at=LATER, field="title", old="Call mur-jobs-1", new="Rettifica")),
        ("mur-jobs-1", CallChange(at=LATER, field="positions", old=1, new=2)),
    ]
    entry = store.entries()["mur-jobs-1"]
    assert entry.deadline == today.deadline
    assert entry.call is not None
    assert (entry.call.title, entry.call.positions) == ("Rettifica", 2)
    assert entry.changes == tuple(change for _, change in changes)
    assert entry.first_seen == NOW
    assert store.observe([today], [SCOPE], LATER + timedelta(days=1)) == []  # told once


def test_observe_ignores_what_listings_do_not_always_show():
    """The sector of some calls comes from their detail page; deadlines and positions may be
    missing from a listing."""
    store = seen(make_call("mur-jobs-1", positions=1))
    today = make_call("mur-jobs-1", gsd=[], ssd=[], deadline=None, positions=None)

    assert store.observe([today], [SCOPE], LATER) == []
    entry = store.entries()["mur-jobs-1"]
    assert entry.deadline == NOW + timedelta(days=10)
    assert entry.call is not None
    assert entry.call.positions == 1
    assert entry.call.gsd == ["INFO-01"]


def test_observe_skips_calls_seen_without_details(tmp_path: Path):
    path = tmp_path / "seen.json"
    path.write_text(
        '{"version": 2, "calls": {\n'
        '"mur-jobs-1": {"deadline": null, "first_seen": "2026-09-24T06:00:00Z"}\n'
        "}}\n"
    )
    store = SeenStore(path)
    assert store.observe([make_call("mur-jobs-1")], [SCOPE], LATER) == []
    assert store.observe([], [SCOPE], LATER + timedelta(days=1)) == []


def test_missing_call_is_withdrawn_when_still_missing_later():
    store = seen(make_call("mur-jobs-1"), *[make_call(f"mur-jobs-{i}") for i in range(2, 6)])
    others = [make_call(f"mur-jobs-{i}") for i in range(2, 6)]

    assert store.observe(others, [SCOPE], NOW) == []
    assert store.entries()["mur-jobs-1"].missing_since == NOW
    assert store.observe(others, [SCOPE], NOW + timedelta(hours=6)) == []  # same day: wait

    withdrawn = CallChange(at=LATER, field="status", old="open", new="withdrawn")
    assert store.observe(others, [SCOPE], LATER) == [("mur-jobs-1", withdrawn)]
    entry = store.entries()["mur-jobs-1"]
    assert entry.withdrawn
    assert entry.missing_since is None
    assert store.observe(others, [SCOPE], LATER + timedelta(days=1)) == []  # told once

    later = LATER + timedelta(days=2)
    reopened = CallChange(at=later, field="status", old="withdrawn", new="open")
    assert store.observe([make_call("mur-jobs-1"), *others], [SCOPE], later) == [
        ("mur-jobs-1", reopened)
    ]
    assert not store.entries()["mur-jobs-1"].withdrawn


def test_missing_call_back_the_next_day_is_not_a_change():
    calls = [make_call(f"mur-jobs-{i}") for i in range(1, 6)]
    store = seen(*calls)

    store.observe(calls[1:], [SCOPE], NOW)
    assert store.observe(calls, [SCOPE], LATER) == []
    assert store.entries()["mur-jobs-1"].missing_since is None
    assert store.observe(calls[1:], [SCOPE], LATER + timedelta(days=1)) == []  # missing again


@pytest.mark.parametrize(
    ("scopes", "deadline"),
    [
        ([], NOW + timedelta(days=10)),  # its section was not read in full
        (["mur-tecno-"], NOW + timedelta(days=10)),
        ([SCOPE], NOW + timedelta(hours=30)),  # closing anyway: may leave the listings early
        ([SCOPE], NOW - timedelta(days=1)),  # closed
    ],
)
def test_missing_calls_ignored(scopes, deadline):
    store = seen(make_call("mur-jobs-1", deadline=deadline), make_call("mur-jobs-2"))
    for day in range(3):
        assert store.observe([make_call("mur-jobs-2")], scopes, NOW + timedelta(days=day)) == []
    assert not store.entries()["mur-jobs-1"].withdrawn


@pytest.mark.parametrize(("open_calls", "missing"), [(1, 1), (5, 5), (8, 4)])
def test_many_missing_calls_at_once_are_the_portal(open_calls, missing):
    calls = [make_call(f"mur-jobs-{i}") for i in range(open_calls)]
    store = seen(*calls)
    for day in range(3):
        assert store.observe(calls[missing:], [SCOPE], NOW + timedelta(days=day)) == []
    assert all(e.missing_since is None for e in store.entries().values())


def test_undated_missing_calls_can_be_withdrawn():
    calls = [make_call("mur-jobs-1", deadline=None), make_call("mur-jobs-2")]
    store = seen(*calls)
    store.observe(calls[1:], [SCOPE], NOW)
    assert [c.field for _, c in store.observe(calls[1:], [SCOPE], LATER)] == ["status"]


def test_changes_round_trip(tmp_path: Path):
    path = tmp_path / "seen.json"
    store = SeenStore(path)
    store.add([make_call("mur-jobs-1"), make_call("mur-jobs-2"), make_call("mur-jobs-3")], NOW)
    store.observe([make_call("mur-jobs-1", title="New"), make_call("mur-jobs-3")], [SCOPE], LATER)
    store.save()

    lines = path.read_text().splitlines()
    assert '"changes": [{"at": "2026-09-25T06:00:00Z", "field": "title"' in lines[1]
    assert lines[2].endswith('"missing_since": "2026-09-25T06:00:00Z"},')
    assert "changes" not in lines[3]
    assert "missing_since" not in lines[3]
    reloaded = SeenStore(path)
    assert reloaded.entries() == store.entries()


def test_prune_uses_the_new_deadline():
    store = seen(make_call("mur-jobs-1"))
    store.observe([make_call("mur-jobs-1", deadline=NOW + timedelta(days=100))], [], LATER)
    store.prune(NOW + timedelta(days=80))
    assert "mur-jobs-1" in store


def test_recent_changes():
    store = seen(make_call("mur-jobs-1"), make_call("mur-jobs-2"))
    store.observe([make_call("mur-jobs-1", title="A"), make_call("mur-jobs-2")], [], NOW)
    store.observe([make_call("mur-jobs-1", title="B"), make_call("mur-jobs-2")], [], LATER)

    recent = store.recent_changes(NOW + timedelta(days=3, hours=1))
    assert {call_id: [c.new for c in changes] for call_id, changes in recent.items()} == {
        "mur-jobs-1": ["B"]
    }
    assert store.recent_changes(NOW + timedelta(days=5)) == {}


def test_complete_records_what_detail_pages_say(tmp_path: Path):
    path = tmp_path / "seen.json"
    store = SeenStore(path)
    store.add([make_call("a", positions=None), make_call("b", positions=2)], NOW)
    read = [
        make_call("a", positions=3, published=date(2026, 9, 1), details=True),
        make_call("b", positions=5, published=date(2026, 9, 2), details=True),
        make_call("c", details=True),  # not seen: ignored
    ]

    assert [c.id for c in store.without_details(read, limit=10)] == ["a", "b"]
    store.complete(read)
    store.save()

    entries = SeenStore(path).entries()
    assert entries["a"].call is not None
    assert (entries["a"].call.positions, entries["a"].call.published) == (3, date(2026, 9, 1))
    assert entries["b"].call is not None
    assert entries["b"].call.positions == 2  # the result list's own value wins
    assert entries["a"].details
    assert '"details": true' in path.read_text()
    assert store.without_details(read, limit=10) == []
    assert "c" not in store


def test_without_details_takes_the_most_recent_first():
    store = SeenStore(Path("/nonexistent/seen.json"))
    store.add([make_call("old")], NOW)
    store.add([make_call("new")], NOW + timedelta(days=1))
    calls = [make_call("old"), make_call("new")]
    assert [c.id for c in store.without_details(calls, limit=1)] == ["new"]


def test_complete_ignores_calls_whose_page_was_not_read():
    store = SeenStore(Path("/nonexistent/seen.json"))
    store.add([make_call("a")], NOW)
    store.complete([make_call("a", published=date(2026, 9, 1))])
    assert not store.entries()["a"].details
