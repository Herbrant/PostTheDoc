import json
from datetime import date
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.config import ZenodoSettings
from postthedoc.zenodo import ZenodoClient, ZenodoError, metadata

URL = "https://sandbox.zenodo.org"
TOKEN = "s3cret-token"  # noqa: S105
BUCKET = f"{URL}/api/files/bucket-2"
META = metadata(date(2026, 11, 1))


def client(record_id: str | None = None) -> ZenodoClient:
    settings = ZenodoSettings(token=TOKEN, url=URL, record_id=record_id)
    return ZenodoClient(httpx.Client(follow_redirects=True), settings)


@pytest.fixture
def files(tmp_path: Path) -> list[Path]:
    paths = [tmp_path / "calls.csv", tmp_path / "README.md"]
    for path in paths:
        path.write_text(f"content of {path.name}")
    return paths


def published(record_id: int) -> httpx.Response:
    return httpx.Response(
        202,
        json={
            "id": record_id,
            "doi": f"10.5072/zenodo.{record_id}",
            "conceptdoi": "10.5072/zenodo.1",
            "links": {
                "html": f"{URL}/deposit/{record_id}",
                "record_html": f"{URL}/records/{record_id}",
            },
        },
    )


@respx.mock
def test_first_publication_creates_the_record(files):
    create = respx.post(f"{URL}/api/deposit/depositions").mock(
        return_value=httpx.Response(201, json={"id": 2, "links": {"bucket": BUCKET}})
    )
    uploads = respx.put(url__startswith=f"{BUCKET}/").mock(
        return_value=httpx.Response(201, json={})
    )
    update = respx.put(f"{URL}/api/deposit/depositions/2").mock(
        return_value=httpx.Response(200, json={})
    )
    publish = respx.post(f"{URL}/api/deposit/depositions/2/actions/publish").mock(
        return_value=published(2)
    )

    result = client().publish(files, META)

    assert result.record_id == "2"
    assert result.doi == "10.5072/zenodo.2"
    assert result.concept_doi == "10.5072/zenodo.1"
    assert result.url == f"{URL}/records/2"
    assert create.called
    assert publish.called
    assert create.calls[0].request.headers["Authorization"] == f"Bearer {TOKEN}"
    assert [c.request.url.path for c in uploads.calls] == [
        "/api/files/bucket-2/calls.csv",
        "/api/files/bucket-2/README.md",
    ]
    assert uploads.calls[0].request.content == b"content of calls.csv"
    sent = json.loads(update.calls[0].request.content)["metadata"]
    assert sent["version"] == "2026-11-01"
    assert sent["creators"] == [{"name": "PostTheDoc"}]
    assert sent["license"] == "cc-by-4.0"


@respx.mock
def test_new_version_replaces_the_files(files):
    respx.get(f"{URL}/api/records/1/versions/latest").mock(
        return_value=httpx.Response(200, json={"id": 5})
    )
    newversion = respx.post(f"{URL}/api/deposit/depositions/5/actions/newversion").mock(
        return_value=httpx.Response(
            201, json={"id": 5, "links": {"latest_draft": f"{URL}/api/deposit/depositions/6"}}
        )
    )
    respx.get(f"{URL}/api/deposit/depositions/6").mock(
        return_value=httpx.Response(
            200,
            json={"id": 6, "links": {"bucket": BUCKET}, "files": [{"id": "a"}, {"id": "b"}]},
        )
    )
    deletes = respx.delete(url__startswith=f"{URL}/api/deposit/depositions/6/files/").mock(
        return_value=httpx.Response(204)
    )
    uploads = respx.put(url__startswith=f"{BUCKET}/").mock(
        return_value=httpx.Response(201, json={})
    )
    respx.put(f"{URL}/api/deposit/depositions/6").mock(return_value=httpx.Response(200, json={}))
    respx.post(f"{URL}/api/deposit/depositions/6/actions/publish").mock(return_value=published(6))

    result = client(record_id="1").publish(files, META)

    assert result.record_id == "6"
    assert newversion.called
    assert [c.request.url.path.rsplit("/", 1)[1] for c in deletes.calls] == ["a", "b"]
    assert uploads.call_count == 2


@respx.mock
def test_new_version_of_the_given_record_when_latest_is_unknown(files):
    respx.get(f"{URL}/api/records/5/versions/latest").mock(return_value=httpx.Response(404))
    newversion = respx.post(f"{URL}/api/deposit/depositions/5/actions/newversion").mock(
        return_value=httpx.Response(500, json={"message": "boom"})
    )

    with pytest.raises(ZenodoError, match="HTTP 500 boom"):
        client(record_id="5").publish(files, META)
    assert newversion.called


@respx.mock
def test_errors_do_not_quote_the_token(files):
    respx.post(f"{URL}/api/deposit/depositions").mock(
        return_value=httpx.Response(403, json={"message": "Permission denied."})
    )
    with pytest.raises(ZenodoError) as info:
        client().publish(files, META)
    assert "403" in str(info.value)
    assert TOKEN not in str(info.value)


@respx.mock
def test_network_errors_are_zenodo_errors(files):
    respx.post(f"{URL}/api/deposit/depositions").mock(side_effect=httpx.ConnectTimeout("slow"))
    with pytest.raises(ZenodoError, match="ConnectTimeout"):
        client().publish(files, META)


@respx.mock
def test_never_sends_the_token_elsewhere(files):
    respx.post(f"{URL}/api/deposit/depositions").mock(
        return_value=httpx.Response(
            201, json={"id": 2, "links": {"bucket": "https://evil.example/api/files/x"}}
        )
    )
    evil = respx.put(url__startswith="https://evil.example/")
    with pytest.raises(ZenodoError, match="Refusing"):
        client().publish(files, META)
    assert not evil.called
