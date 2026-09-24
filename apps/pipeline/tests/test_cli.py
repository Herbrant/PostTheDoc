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
    seen.write_text("{}\n")
    out = tmp_path / "out"
    args = ["run", "--dry-run", "--all", "--sections", "jobs", "--users", str(users)]

    assert main([*args, "--seen", str(seen), "--out", str(out)]) == 0

    text = (out / "a_example.org.txt").read_text()
    assert "Subject: PostTheDoc: 6" in text
    assert "http://localhost:4321/PostTheDoc/it/manage/#t=" in text  # development defaults
    assert seen.read_text() == "{}\n"  # a dry run does not update seen.json


def test_missing_configuration_exits_with_2(tmp_path: Path):
    assert main(["run", "--seen", str(tmp_path / "seen.json")]) == 2
