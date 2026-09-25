"""D1Client against a SQLite database built from the Worker's migrations.

D1 is SQLite: running the client's queries on the real schema catches any drift between the
pipeline and apps/worker/migrations.
"""

import sqlite3

import httpx
import pytest

from postthedoc.storage import D1Client, D1Error
from tests.factories import D1_SETTINGS, add_user


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

    client = D1Client(httpx.Client(transport=httpx.MockTransport(handler)), D1_SETTINGS)
    with pytest.raises(D1Error, match="no"):
        client.query("SELECT 1")


def test_raises_on_http_errors():
    client = D1Client(
        httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(503))), D1_SETTINGS
    )
    with pytest.raises(D1Error):
        client.query("SELECT 1")


def test_raises_on_unexpected_responses():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"success": True, "result": []})

    client = D1Client(httpx.Client(transport=httpx.MockTransport(handler)), D1_SETTINGS)
    with pytest.raises(D1Error):
        client.query("SELECT 1")
    garbage = D1Client(
        httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, text="<html>"))),
        D1_SETTINGS,
    )
    with pytest.raises(D1Error, match="Unexpected"):
        garbage.query("SELECT 1")
