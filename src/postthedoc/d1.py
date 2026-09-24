"""Accesso al database D1 del Worker tramite l'API REST di Cloudflare."""

import json
from collections.abc import Iterable
from datetime import UTC, datetime

import httpx

from postthedoc.models import User

API = "https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query"
MAX_PARAMS = 100  # limite di D1 sui parametri per singola query


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
            raise RuntimeError(f"Query D1 fallita: {body.get('errors')}")
        return body["result"][0]["results"]

    def active_users(self) -> list[User]:
        rows = self.query(
            "SELECT id, email, token_version, roles, sectors, regions, universities,"
            " include_unspecified FROM users WHERE status = 'active'"
        )
        return [
            User(
                id=r["id"],
                email=r["email"],
                token_version=r["token_version"],
                roles=json.loads(r["roles"]),
                sectors=json.loads(r["sectors"]),
                regions=json.loads(r["regions"]),
                universities=json.loads(r["universities"]),
                include_unspecified=bool(r["include_unspecified"]),
            )
            for r in rows
        ]

    def delivered(self, bando_ids: list[str]) -> set[tuple[str, str]]:
        """Coppie (user_id, bando_id) già inviate per i bandi indicati."""
        found: set[tuple[str, str]] = set()
        for chunk in _chunks(bando_ids, MAX_PARAMS):
            placeholders = ",".join("?" * len(chunk))
            rows = self.query(
                f"SELECT user_id, bando_id FROM deliveries WHERE bando_id IN ({placeholders})",
                chunk,
            )
            found.update((r["user_id"], r["bando_id"]) for r in rows)
        return found

    def record_deliveries(self, user_id: str, bando_ids: list[str]) -> None:
        now = datetime.now(UTC).isoformat(timespec="seconds")
        for chunk in _chunks(bando_ids, MAX_PARAMS // 3):
            values = ",".join("(?, ?, ?)" for _ in chunk)
            params = [p for bando_id in chunk for p in (user_id, bando_id, now)]
            self.query(
                f"INSERT OR IGNORE INTO deliveries (user_id, bando_id, sent_at) VALUES {values}",
                params,
            )
