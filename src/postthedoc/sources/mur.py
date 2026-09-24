"""Portale bandi.mur.gov.it (MUR/Cineca).

Ogni sezione del portale ha una pagina di ricerca che, filtrata sui bandi aperti, restituisce
tutti i risultati in un'unica pagina HTML (la paginazione è fatta lato client).
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
from postthedoc.models import Bando
from postthedoc.sources.base import Source

log = logging.getLogger(__name__)

BASE_URL = "https://bandi.mur.gov.it"
ROME = ZoneInfo("Europe/Rome")

SSD_RE = re.compile(r"\b([A-Z]{3,4}-\d{2})/[A-Z]\b")
GSD_DETAIL_RE = re.compile(r"G\.S\.D\.\s*\d{2}/([A-Z]{3,4}-\d{2})")
DEADLINE_RE = re.compile(r"scade il (\d{2}/\d{2}/\d{4})(?:\s*-\s*alle ore (\d{1,2}):(\d{2}))?")
POSTI_RE = re.compile(r"Numero posti:\s*(\d+)")
ID_RE = re.compile(r"/id_(?:job|fellow)/(\d+)")
ORDINARIO_RE = re.compile(r"prima fascia|\bI fascia|ordinari", re.IGNORECASE)


@dataclass(frozen=True)
class Section:
    key: str  # prefisso del path, es. "jobs" -> /jobs.php/...
    kind: str  # "job" | "fellowship"
    role: str | None  # None: il ruolo si ricava dalla qualifica del singolo bando

    @property
    def search_url(self) -> str:
        page = "cercaJobs" if self.kind == "job" else "cercaFellowship"
        return f"{BASE_URL}/{self.key}.php/public/{page}"

    @property
    def search_params(self) -> dict[str, str]:
        status = "jv_comp_status_id" if self.kind == "job" else "jf_comp_status_id"
        return {status: "2-3", "bb_type_code": "%", "azione": "cerca"}


SECTIONS = (
    Section("doctorate", "fellowship", "dottorato"),
    Section("incarichidiricerca", "fellowship", "incarico_ricerca"),
    Section("incarichipostdoc", "fellowship", "incarico_postdoc"),
    Section("contrattidiricerca", "fellowship", "contratto_ricerca"),
    Section("bandi", "fellowship", "assegno_ricerca"),
    Section("jobs", "job", "ricercatore"),
    Section("tecno", "job", "tecnologo"),
    Section("profcalls", "job", None),
)


def _professor_role(qualifica: str, title: str) -> str:
    # La qualifica ("Professore di prima/seconda fascia") è affidabile; il titolo è il ripiego.
    if ORDINARIO_RE.search(qualifica or title):
        return "professore_ordinario"
    return "professore_associato"


def _parse_deadline(text: str) -> datetime | None:
    m = DEADLINE_RE.search(text)
    if not m:
        return None
    day, hour, minute = m.group(1), m.group(2) or "23", m.group(3) or "59"
    return datetime.strptime(f"{day} {hour}:{minute}", "%d/%m/%Y %H:%M").replace(tzinfo=ROME)


def _gsd_from_ssd(ssd: list[str]) -> list[str]:
    return list(dict.fromkeys(code.split("/")[0] for code in ssd))


def _parse_result(p: Node, section: Section) -> Bando | None:
    link = p.css_first("a")
    strongs = p.css("strong")
    if link is None or not strongs:
        return None
    href = link.attributes.get("href") or ""
    id_match = ID_RE.search(href)
    if not id_match:
        return None

    qualifica_node = link.css_first("i")
    qualifica = qualifica_node.text(strip=True).strip("() ") if qualifica_node else ""
    title = " ".join(link.text().split())
    if qualifica_node:
        title = title.removesuffix(" ".join(qualifica_node.text().split())).strip()

    struttura_name = " ".join(strongs[0].text().split())
    struttura = reference.find_struttura(struttura_name)
    if struttura is None:
        log.warning("Struttura non presente in strutture.json: %r", struttura_name)

    ssd: list[str] = []
    for strong in strongs[1:]:
        ssd.extend(m.group(0) for m in SSD_RE.finditer(strong.text()))
    ssd = list(dict.fromkeys(ssd))

    em = p.css_first("em")
    posti = POSTI_RE.search(p.text())
    role = section.role or _professor_role(qualifica, title)

    return Bando(
        id=f"mur-{section.key}-{id_match.group(1)}",
        source="mur",
        role=role,
        title=title,
        url=urljoin(BASE_URL, href),
        struttura_name=struttura["name"] if struttura else struttura_name,
        struttura_code=struttura["code"] if struttura else None,
        regione=struttura["regione"] if struttura else None,
        ssd=ssd,
        gsd=_gsd_from_ssd(ssd),
        deadline=_parse_deadline(em.text()) if em else None,
        posti=int(posti.group(1)) if posti else None,
    )


def parse_search_page(html: str, section: Section) -> list[Bando]:
    tree = HTMLParser(html)
    results = tree.css("#hiddenresult div.result > p")
    bandi = [b for p in results if (b := _parse_result(p, section)) is not None]
    if len(bandi) != len(results):
        log.warning("%s: %d risultati non interpretabili", section.key, len(results) - len(bandi))
    return bandi


def parse_detail_page(html: str) -> tuple[list[str], list[str]]:
    """Restituisce (ssd, gsd) dalla pagina di dettaglio di un bando."""
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

    def fetch(self) -> list[Bando]:
        bandi: list[Bando] = []
        for section in self.sections:
            try:
                resp = self.client.get(section.search_url, params=section.search_params)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.error("%s: download fallito: %s", section.key, exc)
                continue
            found = parse_search_page(resp.text, section)
            log.info("%s: %d bandi aperti", section.key, len(found))
            bandi.extend(found)
        return bandi

    def enrich(self, bandi: list[Bando]) -> None:
        # La lista non riporta sempre il settore (es. dottorati): lo si legge dal dettaglio.
        for bando in bandi:
            if bando.gsd:
                continue
            try:
                resp = self.client.get(bando.url)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.warning("%s: dettaglio non disponibile: %s", bando.id, exc)
                continue
            bando.ssd, bando.gsd = parse_detail_page(resp.text)
            time.sleep(self.detail_delay)
