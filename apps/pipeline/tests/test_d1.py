import json

import httpx

from postthedoc.d1 import D1Client


def client_recording(queries: list[dict]) -> D1Client:
    def handler(request: httpx.Request) -> httpx.Response:
        queries.append(json.loads(request.content))
        return httpx.Response(200, json={"success": True, "result": [{"results": []}]})

    return D1Client(httpx.Client(transport=httpx.MockTransport(handler)), "acc", "db", "token")


def test_purge_pending_deletes_only_stale_unconfirmed_users():
    queries: list[dict] = []
    client_recording(queries).purge_pending()

    [query] = queries
    assert query["sql"].startswith("DELETE FROM users WHERE status = 'pending'")
    assert "updated_at < datetime('now', ?)" in query["sql"]
    assert query["params"] == ["-7 days"]
