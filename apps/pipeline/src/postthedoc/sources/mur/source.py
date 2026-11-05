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
    is_partial_detail_page,
    parse_detail_page,
)
from postthedoc.sources.mur.sections import SECTIONS, Section

log = logging.getLogger(__name__)

# Pause between detail pages, to be gentle with the portal.
DETAIL_DELAY_SECONDS = 0.5
# Waits before trying a request again after a timeout, a 429 or a 5xx: the portal has hiccups,
# and a section that fails for one of them turns the whole daily job red.
RETRY_DELAYS_SECONDS = (5.0, 20.0)
# Sections in a row that never answered after which the portal counts as down. Each takes minutes
# when it answers 504s: going through all of them would use up the job's time limit for nothing,
# the Worker starts the job again later.
PORTAL_DOWN_AFTER_SECTIONS = 2


def _retryable(exc: httpx.HTTPError) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return status == httpx.codes.TOO_MANY_REQUESTS or status >= 500
    return isinstance(exc, httpx.TransportError)  # timeouts, connection errors


def _partial_detail_page(resp: httpx.Response) -> bool:
    return resp.status_code == httpx.codes.INTERNAL_SERVER_ERROR and is_partial_detail_page(
        resp.text
    )


class MurSource:
    name = SOURCE_NAME

    def __init__(
        self,
        client: httpx.Client,
        reference: ReferenceData,
        sections: Sequence[Section] = SECTIONS,
        detail_delay: float | None = None,
        retry_delays: Sequence[float] | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._parser = MurParser(reference)
        self._sections = tuple(sections)
        self._detail_delay = DETAIL_DELAY_SECONDS if detail_delay is None else detail_delay
        self._retry_delays = tuple(RETRY_DELAYS_SECONDS if retry_delays is None else retry_delays)
        self._sleep = sleep

    def _get(
        self,
        url: str,
        params: Mapping[str, str] | None = None,
        usable: Callable[[httpx.Response], bool] | None = None,
    ) -> httpx.Response:
        """GET, tried again after transient failures; raises the last httpx.HTTPError.

        An error response that `usable` accepts is returned as it is.
        """
        delays = iter(self._retry_delays)
        while True:
            try:
                resp = self._client.get(url, params=params)
                if resp.is_error and usable is not None and usable(resp):
                    return resp
                return resp.raise_for_status()
            except httpx.HTTPError as exc:
                delay = next(delays, None)
                if delay is None or not _retryable(exc):
                    raise
                log.warning("%s: %s, retrying in %gs", url, exc, delay)
                self._sleep(delay)

    def fetch(self) -> FetchResult:
        result = FetchResult()
        unanswered = 0
        for section in self._sections:
            if unanswered >= PORTAL_DOWN_AFTER_SECTIONS:
                log.error("%s: not tried, the portal is down", section.key)
                result.failures.append(f"{self.name}/{section.key}")
                continue
            try:
                resp = self._get(section.search_url, params=section.search_params)
            except httpx.HTTPError as exc:
                log.error("%s: download failed: %s", section.key, exc)
                result.failures.append(f"{self.name}/{section.key}")
                unanswered = unanswered + 1 if _retryable(exc) else 0
                continue
            unanswered = 0
            try:
                found, skipped = self._parser.parse_search_page(resp.text, section)
            except LayoutError as exc:
                log.error("%s: unexpected page: %s", section.key, exc)
                result.failures.append(f"{self.name}/{section.key}")
                continue
            log.info("%s: %d open calls", section.key, len(found))
            result.calls.extend(found)
            if not skipped:
                result.scopes.append(f"{self.name}-{section.key}-")
        return result

    def enrich(self, calls: Sequence[Call]) -> list[str]:
        # The result list does not always include the sector (e.g. PhDs) nor the number of
        # positions (e.g. researchers), and never the date of the call: read the detail page.
        failed = []
        for call in calls:
            try:
                resp = self._get(call.url, usable=_partial_detail_page)
            except httpx.HTTPError as exc:
                log.warning("%s: detail page unavailable: %s", call.id, exc)
                if not call.gsd:  # users filtering on sectors would miss it
                    failed.append(call.id)
                continue
            detail = parse_detail_page(resp.text)
            if not call.gsd:
                call.ssd, call.gsd = detail.ssd, detail.gsd
            call.positions = call.positions or detail.positions
            call.published = detail.published
            call.details = True
            self._sleep(self._detail_delay)
        return failed
