"""Publishing the open dataset on Zenodo, through its deposit REST API.

The first publication creates the record; the next ones add a version to it: each version has
its own DOI, and the concept DOI always resolves to the latest one.
"""

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from postthedoc.config import REPOSITORY_URL, ZenodoSettings
from postthedoc.dataset.export import SOURCE_URL

log = logging.getLogger(__name__)

DEPOSITIONS = "/api/deposit/depositions"

type Json = dict[str, Any]


class ZenodoError(Exception):
    """A request to Zenodo failed."""


@dataclass(frozen=True)
class Published:
    record_id: str
    doi: str
    concept_doi: str
    url: str


def metadata(version: date) -> dict[str, Any]:
    """The record's metadata for the dataset as of `version`."""
    return {
        "upload_type": "dataset",
        "title": "PostTheDoc: Italian academic job calls from bandi.mur.gov.it",
        "creators": [{"name": "PostTheDoc"}],
        "description": (
            "<p>Calls for PhDs, research fellowships and contracts, researcher, technologist and"
            " professor positions published on bandi.mur.gov.it, collected every day by"
            " PostTheDoc, with the changes found in them (deadlines extended or brought forward,"
            " titles and positions changed, calls withdrawn before their deadline).</p>"
            "<p>I bandi di dottorato, incarichi e contratti di ricerca, posizioni da ricercatore,"
            " tecnologo e professore pubblicati su bandi.mur.gov.it, raccolti ogni giorno da"
            " PostTheDoc, con le modifiche trovate (scadenze prorogate o anticipate, titoli e posti"
            " modificati, bandi ritirati prima della scadenza).</p>"
            "<p>See README.md for the method and known gaps. / Metodo e lacune in README.md.</p>"
        ),
        "notes": (
            "Not an official dataset of the Italian Ministry of University and Research (MUR):"
            " the calls published by each institution are authoritative. Source: MUR / Cineca,"
            f" {SOURCE_URL}. Non è un dataset ufficiale del MUR: fa fede il bando dell'ente."
        ),
        "access_right": "open",
        "license": "cc-by-4.0",
        "version": version.isoformat(),
        "publication_date": version.isoformat(),
        "language": "ita",
        "keywords": [
            "academic job market",
            "Italy",
            "universities",
            "research positions",
            "public procurement of research staff",
            "bandi",
            "concorsi universitari",
            "open data",
        ],
        "related_identifiers": [
            {"identifier": SOURCE_URL, "relation": "isDerivedFrom", "scheme": "url"},
            {"identifier": REPOSITORY_URL, "relation": "isSupplementedBy", "scheme": "url"},
        ],
    }


class ZenodoClient:
    def __init__(self, client: httpx.Client, settings: ZenodoSettings) -> None:
        self._client = client
        self._settings = settings

    def _request(
        self,
        method: str,
        url: str,
        *,
        json: Json | None = None,
        content: bytes | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Json:
        """Send a request to the configured Zenodo, and only there: it carries the token."""
        if url.startswith("/"):
            url = self._settings.url + url
        if not url.startswith(f"{self._settings.url}/"):
            raise ZenodoError(f"Refusing to send the token outside {self._settings.url}: {url}")
        headers = {**(headers or {}), "Authorization": f"Bearer {self._settings.token}"}
        try:
            resp = self._client.request(method, url, headers=headers, json=json, content=content)
        except httpx.HTTPError as exc:
            raise ZenodoError(f"{method} {url}: {type(exc).__name__}") from None
        if resp.is_error:
            try:
                message = resp.json().get("message", "")
            except ValueError:
                message = ""
            raise ZenodoError(f"{method} {url}: HTTP {resp.status_code} {message}".rstrip())
        body: Json = resp.json() if resp.content else {}
        return body

    def publish(self, files: Sequence[Path], meta: Mapping[str, Any]) -> Published:
        """Publish `files` as a new record, or as a new version of the configured one."""
        draft = self._new_version() if self._settings.record_id else self._new_record()
        draft_id = draft["id"]
        bucket = draft["links"]["bucket"]
        for path in files:
            log.info("Uploading %s", path.name)
            self._request(
                "PUT",
                f"{bucket}/{path.name}",
                content=path.read_bytes(),
                headers={"Content-Type": "application/octet-stream"},
            )
        self._request("PUT", f"{DEPOSITIONS}/{draft_id}", json={"metadata": dict(meta)})
        record = self._request("POST", f"{DEPOSITIONS}/{draft_id}/actions/publish")
        links = record.get("links", {})
        return Published(
            record_id=str(record["id"]),
            doi=record.get("doi", ""),
            concept_doi=record.get("conceptdoi", ""),
            url=links.get("record_html") or links.get("html", ""),
        )

    def _new_record(self) -> Json:
        log.info("Creating the record")
        return self._request("POST", DEPOSITIONS, json={})

    def _new_version(self) -> Json:
        """A draft of a new version of the latest published one, without its files."""
        latest = self._latest(str(self._settings.record_id))
        log.info("Adding a version to record %s", latest)
        version = self._request("POST", f"{DEPOSITIONS}/{latest}/actions/newversion")
        draft = self._request("GET", version["links"]["latest_draft"])
        # The draft starts with the previous version's files: replaced, not added to.
        for file in draft.get("files", []):
            self._request("DELETE", f"{DEPOSITIONS}/{draft['id']}/files/{file['id']}")
        return draft

    def _latest(self, record_id: str) -> str:
        """The latest version of the record any version of it belongs to."""
        try:
            record = self._request("GET", f"/api/records/{record_id}/versions/latest")
        except ZenodoError as exc:
            log.warning("Latest version of %s not found (%s): using it", record_id, exc)
            return record_id
        return str(record["id"])
