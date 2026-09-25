import json
import sqlite3
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.cli import main
from postthedoc.reference import ReferenceData
from postthedoc.stats import DeliveryWindow, Row, SectionRow, collect, to_text
from postthedoc.storage import D1Client, SeenStore
from postthedoc.storage.d1 import API_URL
from tests.factories import NOW, add_user

TODAY = "2026-09-24T06:00:00+00:00"
SEEN = {
    "version": 2,
    "calls": {
        "mur-jobs-1": {"deadline": "2026-10-01T12:00:00Z", "first_seen": "2026-09-23T12:00:00Z"},
        "mur-jobs-2": {"deadline": "2026-09-01T12:00:00Z", "first_seen": "2026-08-01T06:00:00Z"},
        "mur-doctorate-5": {"deadline": None, "first_seen": "2026-09-20T06:00:00Z"},
        "mur-profcalls-9": {
            "deadline": "2026-11-01T12:00:00Z",
            "first_seen": "2026-09-10T06:00:00Z",
        },
    },
}


@pytest.fixture
def seeded(db: sqlite3.Connection) -> sqlite3.Connection:
    add_user(
        db, "u1", roles='["researcher"]', sectors='["INFO-01", "MATH-01"]', regions='["IT-82"]',
        confirmed_at="2026-09-23 10:00:00",
    )  # fmt: skip
    add_user(
        db, "u2", locale="en", roles='["phd", "researcher"]', sectors='["INFO-01"]',
        institutions='["UNICT"]', include_unspecified=0, created_at="2026-08-01 00:00:00",
    )  # fmt: skip
    add_user(db, "u3", status="pending")
    add_user(db, "u4", created_at="2026-09-20 00:00:00")
    db.executemany(
        "INSERT INTO deliveries (user_id, call_id, sent_at) VALUES (?, ?, ?)",
        [
            ("u1", "mur-jobs-1", TODAY),
            ("u1", "mur-jobs-3", TODAY),
            ("u1", "mur-doctorate-5", "2026-09-20T06:00:00+00:00"),
            ("u2", "mur-jobs-1", TODAY),
            ("u2", "mur-jobs-old", "2026-08-01T06:00:00+00:00"),
        ],
    )
    db.commit()
    return db


@pytest.fixture
def seen(tmp_path: Path) -> SeenStore:
    path = tmp_path / "seen.json"
    path.write_text(json.dumps(SEEN))
    return SeenStore(path)


def test_counts_users_by_status_and_preferences(
    d1: D1Client, seeded: sqlite3.Connection, reference: ReferenceData
):
    users = collect(d1, None, reference, NOW).users

    assert (users.active, users.pending) == (3, 1)
    assert users.new == {"1d": 1, "7d": 2, "30d": 2}
    assert users.include_unspecified == 2
    assert users.with_institutions == 1
    assert [(r.code, r.count) for r in users.locales] == [("it", 2), ("en", 1)]
    assert users.roles[0] == Row("researcher", "Researcher", 2)
    assert [(r.code, r.count) for r in users.areas] == [("01", 2), ("", 1)]  # u1 counted once
    assert [(r.code, r.count) for r in users.sectors] == [("INFO-01", 2), ("", 1), ("MATH-01", 1)]
    assert users.sectors[0].label == "Informatica"
    assert users.regions[0] == Row("", "(any)", 2)


def test_counts_deliveries_per_window_and_day(
    d1: D1Client, seeded: sqlite3.Connection, reference: ReferenceData
):
    stats = collect(d1, None, reference, NOW)

    one_day, week, month = stats.deliveries
    assert (one_day.digests, one_day.notifications, one_day.users, one_day.calls) == (2, 3, 2, 2)
    assert (week.digests, week.notifications, week.users, week.calls) == (3, 4, 2, 3)
    assert month == DeliveryWindow(30, 3, 4, 2, 3)
    assert [(d.day, d.digests, d.notifications) for d in stats.daily] == [
        ("2026-09-20", 1, 1),
        ("2026-09-24", 2, 3),
    ]


def test_counts_calls_from_seen_registry(d1: D1Client, seen: SeenStore, reference: ReferenceData):
    calls = collect(d1, seen, reference, NOW).calls

    assert calls is not None
    assert (calls.tracked, calls.open) == (4, 3)
    assert calls.new == {"1d": 1, "7d": 2, "30d": 3}
    assert calls.sections == [
        SectionRow("jobs", "researcher", 1, {"1d": 1, "7d": 1, "30d": 1}),
        SectionRow("doctorate", "phd", 1, {"1d": 0, "7d": 1, "30d": 1}),
        SectionRow("profcalls", "professors", 1, {"1d": 0, "7d": 0, "30d": 1}),
    ]


def test_skips_calls_without_seen_registry(d1: D1Client, tmp_path: Path, reference: ReferenceData):
    stats = collect(d1, SeenStore(tmp_path / "missing.json"), reference, NOW)
    assert stats.calls is None
    assert "seen.json not found" in to_text(stats, reference)


def test_only_reads_the_database(
    d1: D1Client,
    seeded: sqlite3.Connection,
    seen: SeenStore,
    reference: ReferenceData,
    queries: list[dict[str, object]],
):
    collect(d1, seen, reference, NOW)
    assert queries
    assert all(str(q["sql"]).startswith("SELECT") for q in queries)
    assert not any("email" in str(q["sql"]) for q in queries)


def test_text_output(
    d1: D1Client, seeded: sqlite3.Connection, seen: SeenStore, reference: ReferenceData
):
    text = to_text(collect(d1, seen, reference, NOW), reference)

    assert "Users: 3 active, 1 pending confirmation" in text
    assert "New active users: 1 in 1d, 2 in 7d, 2 in 30d" in text
    assert "INFO-01 Informatica" in text
    assert "Calls: 4 tracked, 3 still open, new: 1 in 1d, 2 in 7d, 3 in 30d" in text
    assert "@example.org" not in text


@respx.mock
def test_cli_prints_json(
    db: sqlite3.Connection,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
):
    add_user(db, "u1")

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        rows = [dict(row) for row in db.execute(body["sql"], body["params"])]
        return httpx.Response(200, json={"success": True, "result": [{"results": rows}]})

    respx.post(API_URL.format(account="acc", database="db")).mock(side_effect=handler)
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acc")
    monkeypatch.setenv("D1_DATABASE_ID", "db")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "token")
    seen = tmp_path / "seen.json"
    seen.write_text(json.dumps(SEEN))

    assert main(["stats", "--json", "--seen", str(seen)]) == 0

    data = json.loads(capsys.readouterr().out)
    assert data["users"]["active"] == 1
    assert data["calls"]["tracked"] == 4


def test_cli_requires_d1_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    assert main(["stats"]) == 2
