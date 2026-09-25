"""Access to the Worker's D1 database through the Cloudflare REST API."""

import json
import logging
from collections.abc import Iterator, Sequence
from datetime import UTC, datetime
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from postthedoc.config import D1Settings
from postthedoc.models import User

log = logging.getLogger(__name__)

API_URL = "https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query"
MAX_PARAMS = 100  # D1 limit on bound parameters per query

type Row = dict[str, Any]


class D1Error(Exception):
    """A query failed or D1 could not be reached."""


class _QueryResult(BaseModel):
    results: list[Row]


class _Response(BaseModel):
    """Envelope of the Cloudflare API response to a single statement."""

    success: bool
    errors: list[Any] = []
    result: list[_QueryResult] = []


def _chunks[T](items: Sequence[T], size: int) -> Iterator[Sequence[T]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


class D1Client:
    def __init__(self, client: httpx.Client, settings: D1Settings) -> None:
        self._client = client
        self._url = API_URL.format(account=settings.account_id, database=settings.database_id)
        self._headers = {"Authorization": f"Bearer {settings.api_token}"}

    def query(self, sql: str, params: Sequence[str | int] = ()) -> list[Row]:
        try:
            resp = self._client.post(
                self._url, headers=self._headers, json={"sql": sql, "params": list(params)}
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise D1Error(f"D1 unreachable: {exc}") from exc
        try:
            body = _Response.model_validate_json(resp.content)
        except ValidationError as exc:
            raise D1Error(f"Unexpected D1 response: {exc}") from exc
        if not body.success or not body.result:
            raise D1Error(f"D1 query failed: {body.errors}")
        return body.result[0].results

    def active_users(self) -> list[User]:
        rows = self.query(
            "SELECT id, email, locale, token_version, roles, sectors, regions, institutions,"
            " include_unspecified FROM users WHERE status = 'active'"
        )
        users = []
        for row in rows:
            try:
                users.append(_user_from_row(row))
            except (KeyError, ValueError) as exc:  # ValidationError is a ValueError
                # One malformed row must not stop everybody else's digest.
                log.error("Skipping user %s: malformed row: %s", row.get("id"), exc)
        return users

    def purge_pending(self, days: int) -> None:
        """Forget addresses never confirmed: their confirmation link expired long ago.

        Counted from created_at, which new subscription attempts do not refresh: nobody can keep
        someone else's address pending (and mailed) forever.
        """
        self.query(
            "DELETE FROM users WHERE status = 'pending' AND created_at < datetime('now', ?)",
            [f"-{days} days"],
        )

    def delivered(self, call_ids: Sequence[str]) -> set[tuple[str, str]]:
        """(user_id, call_id) pairs already sent for the given calls."""
        found: set[tuple[str, str]] = set()
        for chunk in _chunks(call_ids, MAX_PARAMS):
            placeholders = ",".join("?" * len(chunk))
            rows = self.query(
                f"SELECT user_id, call_id FROM deliveries WHERE call_id IN ({placeholders})",  # noqa: S608
                chunk,
            )
            found.update((r["user_id"], r["call_id"]) for r in rows)
        return found

    def record_deliveries(self, user_id: str, call_ids: Sequence[str]) -> None:
        now = datetime.now(UTC).isoformat(timespec="seconds")
        for chunk in _chunks(call_ids, MAX_PARAMS // 3):  # three parameters per row
            values = ",".join("(?, ?, ?)" for _ in chunk)
            params = [p for call_id in chunk for p in (user_id, call_id, now)]
            self.query(
                f"INSERT OR IGNORE INTO deliveries (user_id, call_id, sent_at) VALUES {values}",  # noqa: S608
                params,
            )


def _user_from_row(row: Row) -> User:
    """Decode a users row: list columns hold JSON arrays, booleans are 0/1."""
    return User(
        id=row["id"],
        email=row["email"],
        locale=row["locale"],
        token_version=row["token_version"],
        roles=json.loads(row["roles"]),
        sectors=json.loads(row["sectors"]),
        regions=json.loads(row["regions"]),
        institutions=json.loads(row["institutions"]),
        include_unspecified=bool(row["include_unspecified"]),
    )
