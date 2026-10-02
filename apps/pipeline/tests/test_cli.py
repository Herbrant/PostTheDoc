import json
import logging
import shutil
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.archive import ArchiveStore
from postthedoc.cli import main
from postthedoc.sources.mur import SECTIONS_BY_KEY
from tests.factories import REPO_ROOT

JOBS = SECTIONS_BY_KEY["jobs"]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    names = ("SITE_URL", "API_URL", "TOKEN_SECRET", "CLOUDFLARE_ACCOUNT_ID", "BREVO_API_KEY")
    for name in (*names, "ZENODO_TOKEN", "ZENODO_URL", "ZENODO_RECORD_ID"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(autouse=True)
def data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A copy of data/: real runs write the archive there."""
    copy = tmp_path / "data"
    copy.mkdir()
    shutil.copy(REPO_ROOT / "data" / "contract.json", copy)
    shutil.copytree(REPO_ROOT / "data" / "reference", copy / "reference")
    monkeypatch.setenv("POSTTHEDOC_DATA", str(copy))
    return copy


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
def test_dry_run_can_update_a_seen_copy(tmp_path: Path, fixtures: Path):
    respx.get(JOBS.search_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "mur" / "jobs.html").read_text())
    )
    users = tmp_path / "users.json"
    users.write_text("[]")
    seen = tmp_path / "seen.json"
    seen.write_text('{"version": 2, "calls": {}}\n')
    args = ["run", "--dry-run", "--sections", "jobs", "--users", str(users), "--save-seen"]

    assert main([*args, "--seen", str(seen), "--out", str(tmp_path / "out")]) == 0

    calls = json.loads(seen.read_text())["calls"]
    assert len(calls) == 6
    assert all(entry["call"]["role"] == "researcher" for entry in calls.values())


@pytest.mark.parametrize("args", [["--dry-run"], ["--seen", "seen.json"]])
def test_save_seen_needs_a_dry_run_and_a_seen_file(args):
    assert main(["run", "--save-seen", *args]) == 2


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


@respx.mock
def test_real_runs_update_the_archive(
    tmp_path: Path, fixtures: Path, monkeypatch: pytest.MonkeyPatch, data: Path
):
    respx.get(JOBS.search_url).mock(
        return_value=httpx.Response(200, text=(fixtures / "mur" / "jobs.html").read_text())
    )
    for name, value in {
        "BREVO_API_KEY": "key",
        "SENDER_EMAIL": "from@example.org",
        "SITE_URL": "https://site.example",
        "API_URL": "https://api.example",
        "TOKEN_SECRET": "secret",
    }.items():
        monkeypatch.setenv(name, value)
    users = tmp_path / "users.json"
    users.write_text("[]")
    seen = tmp_path / "seen.json"
    args = ["run", "--sections", "jobs", "--users", str(users), "--seen", str(seen)]

    assert main(["run", "--dry-run", *args[1:], "--out", str(tmp_path / "out")]) == 0
    assert not (data / "archive").exists()  # dry runs leave it alone
    assert main(args) == 0

    assert len(ArchiveStore(data / "archive" / "calls.jsonl")) == 6


def write_archive(tmp_path: Path, title: str = "Call") -> Path:
    seen = tmp_path / "seen.json"
    seen.write_text(
        '{"version": 4, "calls": {\n'
        '"mur-jobs-1": {"deadline": null, "first_seen": "2026-09-24T06:00:00Z", "call": {"role":'
        f' "researcher", "title": "{title}", "url": "https://bandi.mur.gov.it/x",'
        ' "institution_name": "Univ. CATANIA"}}\n'
        "}}\n"
    )
    archive = tmp_path / "archive" / "calls.jsonl"
    assert main(["archive", "--seen", str(seen), "--archive", str(archive)]) == 0
    return archive


def test_archive_command(tmp_path: Path):
    archive = write_archive(tmp_path)
    assert [call.id for call in ArchiveStore(archive)] == ["mur-jobs-1"]


def test_export_and_dry_publish(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    archive = write_archive(tmp_path)
    out = tmp_path / "dataset"
    export = ["export-dataset", "--archive", str(archive), "--out", str(out)]

    assert main([*export, "--date", "2026-10-01"]) == 0
    assert "mur-jobs-1" in (out / "calls.csv").read_text()
    assert main(["publish-zenodo", "--dir", str(out), "--dry-run"]) == 0

    plan = json.loads(capsys.readouterr().out)
    assert "calls.csv" in plan["files"]
    assert plan["metadata"]["version"] == "2026-10-01"


def test_export_needs_an_archive(tmp_path: Path, caplog):
    out = tmp_path / "dataset"
    assert (
        main(["export-dataset", "--archive", str(tmp_path / "none.jsonl"), "--out", str(out)]) == 1
    )
    assert "nothing to export" in caplog.text
    assert not out.exists()


def test_export_stops_on_unreviewed_personal_data(tmp_path: Path, caplog):
    archive = write_archive(tmp_path, title="Tutor: Prof. Rossi")
    out = tmp_path / "dataset"

    assert main(["export-dataset", "--archive", str(archive), "--out", str(out)]) == 1
    assert "mur-jobs-1" in caplog.text

    (archive.parent / "reviewed.json").write_text('{"mur-jobs-1": "omit-title"}')
    assert main(["export-dataset", "--archive", str(archive), "--out", str(out)]) == 0


@respx.mock
def test_publish(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog):
    caplog.set_level(logging.INFO)
    archive = write_archive(tmp_path)
    out = tmp_path / "dataset"
    main(["export-dataset", "--archive", str(archive), "--out", str(out), "--date", "2026-10-01"])
    url = "https://sandbox.zenodo.org"
    respx.post(f"{url}/api/deposit/depositions").mock(
        return_value=httpx.Response(201, json={"id": 2, "links": {"bucket": f"{url}/b/2"}})
    )
    respx.put(url__startswith=f"{url}/").mock(return_value=httpx.Response(200, json={}))
    respx.post(f"{url}/api/deposit/depositions/2/actions/publish").mock(
        return_value=httpx.Response(202, json={"id": 2, "doi": "10.5072/zenodo.2", "links": {}})
    )
    monkeypatch.setenv("ZENODO_URL", url)

    assert main(["publish-zenodo", "--dir", str(out)]) == 2  # no token
    monkeypatch.setenv("ZENODO_TOKEN", "token")
    assert main(["publish-zenodo", "--dir", str(out)]) == 0
    assert "10.5072/zenodo.2" in caplog.text

    monkeypatch.setenv("ZENODO_URL", "http://sandbox.zenodo.org")
    assert main(["publish-zenodo", "--dir", str(out)]) == 2  # never in clear


def test_corrupt_seen_file_exits_with_a_message(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    seen = tmp_path / "seen.json"
    seen.write_text("{not json")
    assert main(["stats", "--seen", str(seen)]) == 1
    assert "restore it from git history" in caplog.text
