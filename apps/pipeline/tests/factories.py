"""Builders and constants shared by the tests."""

from datetime import UTC, datetime, timedelta
from typing import Any

from postthedoc.config import data_dir
from postthedoc.models import Call, User

NOW = datetime(2026, 9, 24, 6, 0, tzinfo=UTC)
REPO_ROOT = data_dir().parent


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
