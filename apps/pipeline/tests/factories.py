"""Builders and constants shared by the tests."""

import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Any

from postthedoc.config import D1Settings, data_dir
from postthedoc.models import Call, User

NOW = datetime(2026, 9, 24, 6, 0, tzinfo=UTC)
REPO_ROOT = data_dir().parent
D1_SETTINGS = D1Settings(account_id="acc", database_id="db", api_token="token")


def make_call(call_id: str = "mur-jobs-1", **fields: Any) -> Call:
    base: dict[str, Any] = {
        "id": call_id,
        "source": "fake",
        "role": "researcher",
        "title": f"Call {call_id}",
        "url": f"https://example.org/{call_id}",
        "institution_name": "Univ. CATANIA",
        "institution_code": "UNICT",
        "region": "IT-82",
        "ssd": ["INFO-01/A"],
        "gsd": ["INFO-01"],
        "deadline": NOW + timedelta(days=10),
    }
    return Call(**(base | fields))


def make_user(user_id: str = "u1", **fields: Any) -> User:
    base: dict[str, Any] = {
        "id": user_id,
        "email": f"{user_id}@example.org",
        "roles": ["researcher"],
    }
    return User(**(base | fields))


def add_user(db: sqlite3.Connection, user_id: str, status: str = "active", **cols: object) -> None:
    columns = {"id": user_id, "email": f"{user_id}@example.org", "status": status} | cols
    names = ", ".join(columns)
    placeholders = ", ".join("?" * len(columns))
    db.execute(f"INSERT INTO users ({names}) VALUES ({placeholders})", list(columns.values()))  # noqa: S608
    db.commit()
