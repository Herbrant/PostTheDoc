"""D1Client against a SQLite database built from the Worker's migrations.

D1 is SQLite: running the client's queries on the real schema catches any drift between the
pipeline and apps/worker/migrations.
"""

import json
import sqlite3
from collections.abc import Iterator

import httpx
import pytest

from postthedoc.config import D1Settings
from postthedoc.storage import D1Client, D1Error
from tests.factories import REPO_ROOT

MIGRATIONS = sorted((REPO_ROOT / "apps" / "worker" / "migrations").glob("*.sql"))
SETTINGS = D1Settings(account_id="acc", database_id="db", api_token="token")


@pytest.fixture
def db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    for migration in MIGRATIONS:
        conn.executescript(migration.read_text(encoding="utf-8"))
    yield conn
    conn.close()


@pytest.fixture
def queries() -> list[dict[str, object]]:
    return []


@pytest.fixture
def d1(db: sqlite3.Connection, queries: list[dict[str, object]]) -> D1Client:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer token"
        body = json.loads(request.content)
        queries.append(body)
        rows = [dict(row) for row in db.execute(body["sql"], body["params"])]
        db.commit()
        return httpx.Response(200, json={"success": True, "result": [{"results": rows}]})

    return D1Client(httpx.Client(transport=httpx.MockTransport(handler)), SETTINGS)


def add_user(db: sqlite3.Connection, user_id: str, status: str = "active", **cols: object) -> None:
    columns = {"id": user_id, "email": f"{user_id}@example.org", "status": status} | cols
    names = ", ".join(columns)
    placeholders = ", ".join("?" * len(columns))
    db.execute(f"INSERT INTO users ({names}) VALUES ({placeholders})", list(columns.values()))  # noqa: S608
    db.commit()


def test_active_users(d1: D1Client, db: sqlite3.Connection):
    add_user(db, "u1", locale="en", roles='["phd"]', sectors='["INFO-01"]', include_unspecified=0)
    add_user(db, "u2", status="pending")

    [user] = d1.active_users()

    assert user.id == "u1"
    assert user.locale == "en"
    assert user.roles == ["phd"]
    assert user.sectors == ["INFO-01"]
    assert user.include_unspecified is False


def test_skips_malformed_users(d1: D1Client, db: sqlite3.Connection):
    add_user(db, "good")
    add_user(db, "bad", roles="not json")

    assert [u.id for u in d1.active_users()] == ["good"]


def test_purge_pending_deletes_only_stale_unconfirmed_users(d1: D1Client, db: sqlite3.Connection):
    add_user(db, "stale", status="pending", updated_at="2000-01-01 00:00:00")
    add_user(db, "recent", status="pending")
    add_user(db, "active", updated_at="2000-01-01 00:00:00")

    d1.purge_pending(7)

    remaining = {row["id"] for row in db.execute("SELECT id FROM users")}
    assert remaining == {"recent", "active"}


def test_records_and_reads_deliveries_in_chunks(
    d1: D1Client, db: sqlite3.Connection, queries: list[dict[str, object]]
):
    add_user(db, "u1")
    call_ids = [f"mur-jobs-{i}" for i in range(150)]

    d1.record_deliveries("u1", call_ids)
    d1.record_deliveries("u1", call_ids[:10])  # already recorded: ignored

    assert d1.delivered([*call_ids, "other"]) == {("u1", c) for c in call_ids}
    assert all(len(q["params"]) <= 100 for q in queries)  # type: ignore[arg-type]


def test_deliveries_are_deleted_with_the_user(d1: D1Client, db: sqlite3.Connection):
    add_user(db, "u1")
    d1.record_deliveries("u1", ["a"])
    db.execute("DELETE FROM users WHERE id = 'u1'")
    assert d1.delivered(["a"]) == set()


def test_raises_on_failed_queries():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"success": False, "errors": [{"message": "no"}]})

    client = D1Client(httpx.Client(transport=httpx.MockTransport(handler)), SETTINGS)
    with pytest.raises(D1Error, match="no"):
        client.query("SELECT 1")


def test_raises_on_http_errors():
    client = D1Client(
        httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(503))), SETTINGS
    )
    with pytest.raises(D1Error):
        client.query("SELECT 1")


def test_raises_on_unexpected_responses():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"success": True, "result": []})

    client = D1Client(httpx.Client(transport=httpx.MockTransport(handler)), SETTINGS)
    with pytest.raises(D1Error):
        client.query("SELECT 1")
    garbage = D1Client(
        httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, text="<html>"))),
        SETTINGS,
    )
    with pytest.raises(D1Error, match="Unexpected"):
        garbage.query("SELECT 1")
