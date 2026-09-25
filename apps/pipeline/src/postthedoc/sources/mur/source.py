"""The bandi.mur.gov.it portal (MUR/Cineca).

Each section of the portal has a search page that, filtered on open calls, returns every result
in a single HTML page (pagination happens client side).
"""

import logging
import time
from collections.abc import Callable, Mapping, Sequence

import httpx

from postthedoc.models import Call
from postthedoc.reference import ReferenceData
from postthedoc.sources.base import FetchResult
from postthedoc.sources.mur.parser import (
    SOURCE_NAME,
    LayoutError,
    MurParser,
    parse_detail_page,
)
from postthedoc.sources.mur.sections import SECTIONS, Section

log = logging.getLogger(__name__)

# Pause between detail pages, to be gentle with the portal.
DETAIL_DELAY_SECONDS = 0.5
# Waits before trying a request again after a timeout, a 429 or a 5xx: the portal has hiccups,
# and a section that fails for one of them turns the whole daily job red.
RETRY_DELAYS_SECONDS = (5.0, 20.0)


def _retryable(exc: httpx.HTTPError) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return status == httpx.codes.TOO_MANY_REQUESTS or status >= 500
    return isinstance(exc, httpx.TransportError)  # timeouts, connection errors


class MurSource:
    name = SOURCE_NAME

    def __init__(
        self,
        client: httpx.Client,
        reference: ReferenceData,
        sections: Sequence[Section] = SECTIONS,
        detail_delay: float = DETAIL_DELAY_SECONDS,
        retry_delays: Sequence[float] | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._parser = MurParser(reference)
        self._sections = tuple(sections)
        self._detail_delay = detail_delay
        self._retry_delays = tuple(RETRY_DELAYS_SECONDS if retry_delays is None else retry_delays)
        self._sleep = sleep

    def _get(self, url: str, params: Mapping[str, str] | None = None) -> httpx.Response:
        """GET, tried again after transient failures; raises the last httpx.HTTPError."""
        delays = iter(self._retry_delays)
        while True:
            try:
                resp = self._client.get(url, params=params)
                return resp.raise_for_status()
            except httpx.HTTPError as exc:
                delay = next(delays, None)
                if delay is None or not _retryable(exc):
                    raise
                log.warning("%s: %s, retrying in %gs", url, exc, delay)
                self._sleep(delay)

    def fetch(self) -> FetchResult:
        result = FetchResult()
        for section in self._sections:
            try:
                resp = self._get(section.search_url, params=section.search_params)
            except httpx.HTTPError as exc:
                log.error("%s: download failed: %s", section.key, exc)
                result.failures.append(f"{self.name}/{section.key}")
                continue
            try:
                found = self._parser.parse_search_page(resp.text, section)
            except LayoutError as exc:
                log.error("%s: unexpected page: %s", section.key, exc)
                result.failures.append(f"{self.name}/{section.key}")
                continue
            log.info("%s: %d open calls", section.key, len(found))
            result.calls.extend(found)
        return result

    def enrich(self, calls: Sequence[Call]) -> list[str]:
        # The result list does not always include the sector (e.g. PhDs): read it from the detail.
        failed = []
        for call in calls:
            if call.gsd:
                continue
            try:
                resp = self._get(call.url)
            except httpx.HTTPError as exc:
                log.warning("%s: detail page unavailable: %s", call.id, exc)
                failed.append(call.id)
                continue
            call.ssd, call.gsd = parse_detail_page(resp.text)
            self._sleep(self._detail_delay)
        return failed
