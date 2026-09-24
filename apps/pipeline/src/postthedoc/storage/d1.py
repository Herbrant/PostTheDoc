"""Access to the Worker's D1 database through the Cloudflare REST API."""

import json
from collections.abc import Iterator, Sequence
from datetime import UTC, datetime
from typing import Any

import httpx

from postthedoc.config import D1Settings
from postthedoc.models import User

API_URL = "https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query"
MAX_PARAMS = 100  # D1 limit on bound parameters per query

type Row = dict[str, Any]


class D1Error(Exception):
    """A query failed or D1 could not be reached."""


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
        body = resp.json()
        if not body.get("success"):
            raise D1Error(f"D1 query failed: {body.get('errors')}")
        rows: list[Row] = body["result"][0]["results"]
        return rows

    def active_users(self) -> list[User]:
        rows = self.query(
            "SELECT id, email, locale, token_version, roles, sectors, regions, institutions,"
            " include_unspecified FROM users WHERE status = 'active'"
        )
        return [
            User(
                id=r["id"],
                email=r["email"],
                locale=r["locale"],
                token_version=r["token_version"],
                roles=json.loads(r["roles"]),
                sectors=json.loads(r["sectors"]),
                regions=json.loads(r["regions"]),
                institutions=json.loads(r["institutions"]),
                include_unspecified=bool(r["include_unspecified"]),
            )
            for r in rows
        ]

    def purge_pending(self, days: int) -> None:
        """Forget addresses never confirmed: their confirmation link expired long ago.

        updated_at is refreshed by every new subscription attempt, so recent links survive.
        """
        self.query(
            "DELETE FROM users WHERE status = 'pending' AND updated_at < datetime('now', ?)",
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
