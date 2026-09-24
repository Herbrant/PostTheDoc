"""Access to the Worker's D1 database through the Cloudflare REST API."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime

import httpx

from postthedoc.models import User

API = "https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query"
MAX_PARAMS = 100  # D1 limit on bound parameters per query
PENDING_RETENTION_DAYS = 7  # confirmation links expire after 48 hours


def _chunks[T](items: list[T], size: int) -> Iterable[list[T]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


class D1Client:
    def __init__(self, client: httpx.Client, account_id: str, database_id: str, api_token: str):
        self.client = client
        self.url = API.format(account=account_id, database=database_id)
        self.headers = {"Authorization": f"Bearer {api_token}"}

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        resp = self.client.post(
            self.url, headers=self.headers, json={"sql": sql, "params": params or []}
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            raise RuntimeError(f"D1 query failed: {body.get('errors')}")
        return body["result"][0]["results"]

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

    def purge_pending(self, days: int = PENDING_RETENTION_DAYS) -> None:
        """Forget addresses never confirmed: their confirmation link expired long ago.

        updated_at is refreshed by every new subscription attempt, so recent links survive.
        """
        self.query(
            "DELETE FROM users WHERE status = 'pending' AND updated_at < datetime('now', ?)",
            [f"-{days} days"],
        )

    def delivered(self, call_ids: list[str]) -> set[tuple[str, str]]:
        """(user_id, call_id) pairs already sent for the given calls."""
        found: set[tuple[str, str]] = set()
        for chunk in _chunks(call_ids, MAX_PARAMS):
            placeholders = ",".join("?" * len(chunk))
            rows = self.query(
                f"SELECT user_id, call_id FROM deliveries WHERE call_id IN ({placeholders})",
                chunk,
            )
            found.update((r["user_id"], r["call_id"]) for r in rows)
        return found

    def record_deliveries(self, user_id: str, call_ids: list[str]) -> None:
        now = datetime.now(UTC).isoformat(timespec="seconds")
        for chunk in _chunks(call_ids, MAX_PARAMS // 3):
            values = ",".join("(?, ?, ?)" for _ in chunk)
            params = [p for call_id in chunk for p in (user_id, call_id, now)]
            self.query(
                f"INSERT OR IGNORE INTO deliveries (user_id, call_id, sent_at) VALUES {values}",
                params,
            )
