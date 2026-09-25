import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

from postthedoc.config import data_dir
from postthedoc.contract import Contract
from postthedoc.reference import ReferenceData
from postthedoc.storage import D1Client
from tests.factories import D1_SETTINGS, REPO_ROOT

MIGRATIONS = sorted((REPO_ROOT / "apps" / "worker" / "migrations").glob("*.sql"))


@pytest.fixture(scope="session")
def contract() -> Contract:
    return Contract.load(data_dir() / "contract.json")


@pytest.fixture(scope="session")
def reference() -> ReferenceData:
    return ReferenceData.load(data_dir() / "reference")


@pytest.fixture(scope="session")
def fixtures() -> Path:
    return Path(__file__).parent / "fixtures"


# D1 is SQLite: an in-memory database built from the Worker's migrations stands in for it.
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

    return D1Client(httpx.Client(transport=httpx.MockTransport(handler)), D1_SETTINGS)
