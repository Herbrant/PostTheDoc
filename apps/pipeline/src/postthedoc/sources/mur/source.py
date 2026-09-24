"""The bandi.mur.gov.it portal (MUR/Cineca).

Each section of the portal has a search page that, filtered on open calls, returns every result
in a single HTML page (pagination happens client side).
"""

import logging
import time
from collections.abc import Sequence

import httpx

from postthedoc.models import Call
from postthedoc.reference import ReferenceData
from postthedoc.sources.base import FetchResult
from postthedoc.sources.mur.parser import SOURCE_NAME, MurParser, parse_detail_page
from postthedoc.sources.mur.sections import SECTIONS, Section

log = logging.getLogger(__name__)

# Pause between detail pages, to be gentle with the portal.
DETAIL_DELAY_SECONDS = 0.5


class MurSource:
    name = SOURCE_NAME

    def __init__(
        self,
        client: httpx.Client,
        reference: ReferenceData,
        sections: Sequence[Section] = SECTIONS,
        detail_delay: float = DETAIL_DELAY_SECONDS,
    ) -> None:
        self._client = client
        self._parser = MurParser(reference)
        self._sections = tuple(sections)
        self._detail_delay = detail_delay

    def fetch(self) -> FetchResult:
        result = FetchResult()
        for section in self._sections:
            try:
                resp = self._client.get(section.search_url, params=section.search_params)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.error("%s: download failed: %s", section.key, exc)
                result.failures.append(f"{self.name}/{section.key}")
                continue
            found = self._parser.parse_search_page(resp.text, section)
            log.info("%s: %d open calls", section.key, len(found))
            result.calls.extend(found)
        return result

    def enrich(self, calls: Sequence[Call]) -> None:
        # The result list does not always include the sector (e.g. PhDs): read it from the detail.
        for call in calls:
            if call.gsd:
                continue
            try:
                resp = self._client.get(call.url)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.warning("%s: detail page unavailable: %s", call.id, exc)
                continue
            call.ssd, call.gsd = parse_detail_page(resp.text)
            time.sleep(self._detail_delay)
