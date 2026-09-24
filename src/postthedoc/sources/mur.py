"""The bandi.mur.gov.it portal (MUR/Cineca).

Each section of the portal has a search page that, filtered on open calls, returns every result
in a single HTML page (pagination happens client side).

The portal is in Italian, so the regular expressions below match Italian text.
"""

import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import httpx
from selectolax.parser import HTMLParser, Node

from postthedoc import reference
from postthedoc.models import Call
from postthedoc.sources.base import Source

log = logging.getLogger(__name__)

BASE_URL = "https://bandi.mur.gov.it"
ROME = ZoneInfo("Europe/Rome")

SSD_RE = re.compile(r"\b([A-Z]{3,4}-\d{2})/[A-Z]\b")
GSD_DETAIL_RE = re.compile(r"G\.S\.D\.\s*\d{2}/([A-Z]{3,4}-\d{2})")
DEADLINE_RE = re.compile(r"scade il (\d{2}/\d{2}/\d{4})(?:\s*-\s*alle ore (\d{1,2}):(\d{2}))?")
POSITIONS_RE = re.compile(r"Numero posti:\s*(\d+)")
ID_RE = re.compile(r"/id_(?:job|fellow)/(\d+)")
FULL_PROFESSOR_RE = re.compile(r"prima fascia|\bI fascia|ordinari", re.IGNORECASE)


@dataclass(frozen=True)
class Section:
    key: str  # path prefix, e.g. "jobs" -> /jobs.php/...
    kind: str  # "job" | "fellowship"
    role: str | None  # None: the role depends on each call's qualification

    @property
    def search_url(self) -> str:
        page = "cercaJobs" if self.kind == "job" else "cercaFellowship"
        return f"{BASE_URL}/{self.key}.php/public/{page}"

    @property
    def search_params(self) -> dict[str, str]:
        status = "jv_comp_status_id" if self.kind == "job" else "jf_comp_status_id"
        return {status: "2-3", "bb_type_code": "%", "azione": "cerca"}


SECTIONS = (
    Section("doctorate", "fellowship", "phd"),
    Section("incarichidiricerca", "fellowship", "research_fellowship"),
    Section("incarichipostdoc", "fellowship", "postdoc_fellowship"),
    Section("contrattidiricerca", "fellowship", "research_contract"),
    Section("bandi", "fellowship", "research_grant"),
    Section("jobs", "job", "researcher"),
    Section("tecno", "job", "technologist"),
    Section("profcalls", "job", None),
)


def _professor_role(qualification: str, title: str) -> str:
    # The qualification ("Professore di prima/seconda fascia") is reliable; the title is a fallback.
    if FULL_PROFESSOR_RE.search(qualification or title):
        return "full_professor"
    return "associate_professor"


def _parse_deadline(text: str) -> datetime | None:
    m = DEADLINE_RE.search(text)
    if not m:
        return None
    day, hour, minute = m.group(1), m.group(2) or "23", m.group(3) or "59"
    return datetime.strptime(f"{day} {hour}:{minute}", "%d/%m/%Y %H:%M").replace(tzinfo=ROME)


def _gsd_from_ssd(ssd: list[str]) -> list[str]:
    return list(dict.fromkeys(code.split("/")[0] for code in ssd))


def _parse_result(p: Node, section: Section) -> Call | None:
    link = p.css_first("a")
    strongs = p.css("strong")
    if link is None or not strongs:
        return None
    href = link.attributes.get("href") or ""
    id_match = ID_RE.search(href)
    if not id_match:
        return None

    qualification_node = link.css_first("i")
    qualification = qualification_node.text(strip=True).strip("() ") if qualification_node else ""
    title = " ".join(link.text().split())
    if qualification_node:
        title = title.removesuffix(" ".join(qualification_node.text().split())).strip()

    institution_name = " ".join(strongs[0].text().split())
    institution = reference.find_institution(institution_name)
    if institution is None:
        log.warning("Institution missing from institutions.json: %r", institution_name)

    ssd: list[str] = []
    for strong in strongs[1:]:
        ssd.extend(m.group(0) for m in SSD_RE.finditer(strong.text()))
    ssd = list(dict.fromkeys(ssd))

    em = p.css_first("em")
    positions = POSITIONS_RE.search(p.text())
    role = section.role or _professor_role(qualification, title)

    return Call(
        id=f"mur-{section.key}-{id_match.group(1)}",
        source="mur",
        role=role,
        title=title,
        url=urljoin(BASE_URL, href),
        institution_name=institution["name"] if institution else institution_name,
        institution_code=institution["code"] if institution else None,
        region=institution["region"] if institution else None,
        ssd=ssd,
        gsd=_gsd_from_ssd(ssd),
        deadline=_parse_deadline(em.text()) if em else None,
        positions=int(positions.group(1)) if positions else None,
    )


def parse_search_page(html: str, section: Section) -> list[Call]:
    tree = HTMLParser(html)
    results = tree.css("#hiddenresult div.result > p")
    calls = [c for p in results if (c := _parse_result(p, section)) is not None]
    if len(calls) != len(results):
        log.warning("%s: %d results could not be parsed", section.key, len(results) - len(calls))
    return calls


def parse_detail_page(html: str) -> tuple[list[str], list[str]]:
    """Return (ssd, gsd) from a call's detail page."""
    main = HTMLParser(html).css_first("#mainContent")
    text = main.text() if main else ""
    ssd = list(dict.fromkeys(m.group(0) for m in SSD_RE.finditer(text)))
    gsd = list(dict.fromkeys([*GSD_DETAIL_RE.findall(text), *_gsd_from_ssd(ssd)]))
    return ssd, gsd


class MurSource(Source):
    name = "mur"

    def __init__(
        self,
        client: httpx.Client,
        sections: tuple[Section, ...] = SECTIONS,
        detail_delay: float = 0.5,
    ):
        self.client = client
        self.sections = sections
        self.detail_delay = detail_delay

    def fetch(self) -> list[Call]:
        calls: list[Call] = []
        for section in self.sections:
            try:
                resp = self.client.get(section.search_url, params=section.search_params)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.error("%s: download failed: %s", section.key, exc)
                continue
            found = parse_search_page(resp.text, section)
            log.info("%s: %d open calls", section.key, len(found))
            calls.extend(found)
        return calls

    def enrich(self, calls: list[Call]) -> None:
        # The result list does not always include the sector (e.g. PhDs): read it from the detail.
        for call in calls:
            if call.gsd:
                continue
            try:
                resp = self.client.get(call.url)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.warning("%s: detail page unavailable: %s", call.id, exc)
                continue
            call.ssd, call.gsd = parse_detail_page(resp.text)
            time.sleep(self.detail_delay)
