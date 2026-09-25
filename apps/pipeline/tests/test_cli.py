import json
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.cli import main
from postthedoc.sources.mur import SECTIONS_BY_KEY

JOBS = SECTIONS_BY_KEY["jobs"]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("SITE_URL", "API_URL", "TOKEN_SECRET", "CLOUDFLARE_ACCOUNT_ID", "BREVO_API_KEY"):
        monkeypatch.delenv(name, raising=False)


@respx.mock
def test_dry_run_writes_digests(tmp_path: Path, fixtures: Path):
    respx.get(JOBS.search_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "mur" / "jobs.html").read_text())
    )
    users = tmp_path / "users.json"
    users.write_text(json.dumps([{"id": "u1", "email": "a@example.org", "roles": ["researcher"]}]))
    seen = tmp_path / "seen.json"
    seen.write_text('{"version": 2, "calls": {}}\n')
    out = tmp_path / "out"
    args = ["run", "--dry-run", "--all", "--sections", "jobs", "--users", str(users)]

    assert main([*args, "--seen", str(seen), "--out", str(out)]) == 0

    text = (out / "a_example.org.txt").read_text()
    assert "Subject: PostTheDoc: 6" in text
    assert "http://localhost:4321/PostTheDoc/it/manage/#t=" in text  # development defaults
    assert seen.read_text() == '{"version": 2, "calls": {}}\n'  # dry runs do not update it


@respx.mock
def test_fails_when_users_approach_the_digest_quota(
    tmp_path: Path, fixtures: Path, caplog: pytest.LogCaptureFixture
):
    respx.get(JOBS.search_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "mur" / "jobs.html").read_text())
    )

    def write_users(n: int) -> None:
        users.write_text(json.dumps([{"id": f"u{i}", "email": f"u{i}@x.org"} for i in range(n)]))

    users = tmp_path / "users.json"
    # 80% of the 200 digests left by the contract's daily emails (300, 100 of them the Worker's).
    write_users(161)
    seen = tmp_path / "seen.json"
    seen.write_text('{"version": 2, "calls": {}}\n')
    args = ["run", "--dry-run", "--sections", "jobs", "--users", str(users), "--seen", str(seen)]

    assert main([*args, "--out", str(tmp_path / "out")]) == 1
    assert "161 active users" in caplog.text

    write_users(160)
    assert main([*args, "--out", str(tmp_path / "out")]) == 0


def test_missing_configuration_exits_with_2(tmp_path: Path):
    assert main(["run", "--seen", str(tmp_path / "seen.json")]) == 2


@respx.mock
def test_failed_bootstrap_leaves_no_seen_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    respx.get(JOBS.search_url).mock(return_value=httpx.Response(503))
    monkeypatch.setattr("postthedoc.sources.mur.source.RETRY_DELAYS_SECONDS", ())
    users = tmp_path / "users.json"
    users.write_text("[]")
    seen = tmp_path / "seen.json"
    monkeypatch.setenv("BREVO_API_KEY", "key")
    monkeypatch.setenv("SENDER_EMAIL", "from@example.org")
    monkeypatch.setenv("SITE_URL", "https://site.example")
    monkeypatch.setenv("API_URL", "https://api.example")
    monkeypatch.setenv("TOKEN_SECRET", "secret")

    assert main(["run", "--sections", "jobs", "--users", str(users), "--seen", str(seen)]) == 1
    assert not seen.exists()


def test_unknown_sections_are_rejected():
    assert main(["run", "--dry-run", "--sections", "jobs,nope"]) == 2


@respx.mock
def test_housekeeping_failures_do_not_stop_the_run(
    tmp_path: Path, fixtures: Path, monkeypatch: pytest.MonkeyPatch
):
    respx.get(JOBS.search_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "mur" / "jobs.html").read_text())
    )

    def d1(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["sql"].startswith("DELETE"):
            return httpx.Response(500)
        return httpx.Response(200, json={"success": True, "result": [{"results": []}]})

    respx.post(url__startswith="https://api.cloudflare.com/").mock(side_effect=d1)
    for name, value in {
        "CLOUDFLARE_ACCOUNT_ID": "acct",
        "D1_DATABASE_ID": "db",
        "CLOUDFLARE_API_TOKEN": "token",
        "BREVO_API_KEY": "key",
        "SENDER_EMAIL": "from@example.org",
        "SITE_URL": "https://site.example",
        "API_URL": "https://api.example",
        "TOKEN_SECRET": "secret",
    }.items():
        monkeypatch.setenv(name, value)
    seen = tmp_path / "seen.json"

    assert main(["run", "--sections", "jobs", "--seen", str(seen)]) == 1  # noticed...
    assert seen.exists()  # ...but the run went on


def test_corrupt_seen_file_exits_with_a_message(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    seen = tmp_path / "seen.json"
    seen.write_text("{not json")
    assert main(["stats", "--seen", str(seen)]) == 1
    assert "restore it from git history" in caplog.text
