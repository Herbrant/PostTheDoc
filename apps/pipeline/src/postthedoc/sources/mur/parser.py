"""Parsing of bandi.mur.gov.it pages.

The portal is in Italian, so the regular expressions below match Italian text.
"""

import logging
import re
from datetime import datetime
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from selectolax.parser import HTMLParser, Node

from postthedoc.models import Call
from postthedoc.reference import ReferenceData
from postthedoc.sources.mur.sections import BASE_URL, Section
from postthedoc.text import squash_whitespace, unique

log = logging.getLogger(__name__)

SOURCE_NAME = "mur"
ROME = ZoneInfo("Europe/Rome")

SSD_RE = re.compile(r"\b([A-Z]{3,4}-\d{2})/[A-Z]\b")
GSD_DETAIL_RE = re.compile(r"G\.S\.D\.\s*\d{2}/([A-Z]{3,4}-\d{2})")
DEADLINE_RE = re.compile(r"scade il (\d{2}/\d{2}/\d{4})(?:\s*-\s*alle ore (\d{1,2}):(\d{2}))?")
POSITIONS_RE = re.compile(r"Numero posti:\s*(\d+)")
ID_RE = re.compile(r"/id_(?:job|fellow)/(\d+)")
FULL_PROFESSOR_RE = re.compile(r"prima fascia|\bI fascia|ordinari", re.IGNORECASE)

# A deadline without a time lasts the whole day.
END_OF_DAY = ("23", "59")


def _professor_role(qualification: str, title: str) -> str:
    # The qualification ("Professore di prima/seconda fascia") is reliable; the title is a fallback.
    if FULL_PROFESSOR_RE.search(qualification or title):
        return "full_professor"
    return "associate_professor"


def _parse_deadline(text: str) -> datetime | None:
    match = DEADLINE_RE.search(text)
    if not match:
        return None
    day = match.group(1)
    hour, minute = (match.group(2), match.group(3)) if match.group(2) else END_OF_DAY
    return datetime.strptime(f"{day} {hour}:{minute}", "%d/%m/%Y %H:%M").replace(tzinfo=ROME)


def _gsd_from_ssd(ssd: list[str]) -> list[str]:
    return unique(code.split("/")[0] for code in ssd)


def _portal_url(href: str) -> str | None:
    """Absolute URL of a result link, or None if it leads outside the portal.

    The link ends up in the digests and is fetched by enrich(): it must stay on the portal.
    """
    url = urljoin(BASE_URL, href)
    return url if url.startswith(f"{BASE_URL}/") else None


def _title_and_qualification(link: Node) -> tuple[str, str]:
    """The link reads "<title> <i>(<qualification>)</i>": split the two."""
    title = squash_whitespace(link.text())
    qualification_node = link.css_first("i")
    if qualification_node is None:
        return title, ""
    qualification = qualification_node.text(strip=True).strip("() ")
    title = title.removesuffix(squash_whitespace(qualification_node.text())).strip()
    return title, qualification


class MurParser:
    def __init__(self, reference: ReferenceData) -> None:
        self._reference = reference

    def parse_search_page(self, html: str, section: Section) -> list[Call]:
        results = HTMLParser(html).css("#hiddenresult div.result > p")
        calls = [c for p in results if (c := self._parse_result(p, section)) is not None]
        if skipped := len(results) - len(calls):
            log.warning("%s: %d results could not be parsed", section.key, skipped)
        return calls

    def _parse_result(self, p: Node, section: Section) -> Call | None:
        link = p.css_first("a")
        strongs = p.css("strong")
        if link is None or not strongs:
            return None
        href = link.attributes.get("href") or ""
        id_match = ID_RE.search(href)
        if not id_match:
            return None
        url = _portal_url(href)
        if url is None:
            log.warning("Link outside %s ignored: %r", BASE_URL, href)
            return None

        title, qualification = _title_and_qualification(link)
        institution_name = squash_whitespace(strongs[0].text())
        institution = self._reference.find_institution(institution_name)
        if institution is None:
            log.warning("Institution missing from institutions.json: %r", institution_name)

        ssd = unique(m.group(0) for strong in strongs[1:] for m in SSD_RE.finditer(strong.text()))
        deadline = p.css_first("em")
        positions = POSITIONS_RE.search(p.text())

        return Call(
            id=f"{SOURCE_NAME}-{section.key}-{id_match.group(1)}",
            source=SOURCE_NAME,
            role=section.role or _professor_role(qualification, title),
            title=title,
            url=url,
            institution_name=institution.name if institution else institution_name,
            institution_code=institution.code if institution else None,
            region=institution.region if institution else None,
            ssd=ssd,
            gsd=_gsd_from_ssd(ssd),
            deadline=_parse_deadline(deadline.text()) if deadline else None,
            positions=int(positions.group(1)) if positions else None,
        )


def parse_detail_page(html: str) -> tuple[list[str], list[str]]:
    """Return (ssd, gsd) from a call's detail page."""
    main = HTMLParser(html).css_first("#mainContent")
    text = main.text() if main else ""
    ssd = unique(m.group(0) for m in SSD_RE.finditer(text))
    gsd = unique([*GSD_DETAIL_RE.findall(text), *_gsd_from_ssd(ssd)])
    return ssd, gsd
