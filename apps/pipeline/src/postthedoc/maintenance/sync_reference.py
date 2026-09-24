"""Update data/reference/{institutions,sectors}.json from the bandi.mur.gov.it search menus.

Regions of new institutions must be filled in by hand: the portal does not expose them.
"""

import json
import logging
from pathlib import Path

import httpx
from pydantic import TypeAdapter
from selectolax.parser import HTMLParser

from postthedoc.contract import InstitutionType
from postthedoc.reference import Institution, LocalizedText, SectorArea, SectorGroup, Sectors
from postthedoc.sources.mur.sections import ANY, SECTIONS
from postthedoc.text import squash_whitespace

log = logging.getLogger(__name__)

# Names of the <select> menus of the search forms.
INSTITUTION_MENU = "bb_type_code"
GSD_MENU = "idgsd24"  # options are "<area>/<G.S.D. code>", labels "<code> - <name>"

_INSTITUTIONS = TypeAdapter(list[Institution])


def _options(tree: HTMLParser, select_name: str) -> dict[str, str]:
    return {
        value: squash_whitespace(option.text())
        for option in tree.css(f'select[name="{select_name}"] option')
        if (value := option.attributes.get("value")) and value != ANY
    }


def _guess_type(code: str, name: str) -> InstitutionType:
    """A best guess from the MUR code and name: review new institutions by hand."""
    if name.startswith("CNR") or "Istituto" in name:
        return "research_institute"
    if code.startswith(("ABA", "CDM", "ISSM", "ISIA")):
        return "afam"
    if "Telemat" in name:
        return "online_university"
    return "university"


def _write(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _dump(models: list[Institution]) -> list[dict[str, object]]:
    return [m.model_dump() for m in models]


def _fetch_menus(client: httpx.Client) -> tuple[dict[str, str], dict[str, str]]:
    """(institution code -> name, "<area>/<G.S.D.>" -> label) across every section."""
    institutions: dict[str, str] = {}
    groups: dict[str, str] = {}
    for section in SECTIONS:
        resp = client.get(section.search_url)
        resp.raise_for_status()
        tree = HTMLParser(resp.text)
        for code, name in _options(tree, INSTITUTION_MENU).items():
            institutions.setdefault(code, name)
        groups.update(_options(tree, GSD_MENU))
    return institutions, groups


def _merge_institutions(path: Path, found: dict[str, str]) -> list[Institution]:
    known = {i.code: i for i in _INSTITUTIONS.validate_json(path.read_bytes())}
    for code, name in found.items():
        if code in known:
            known[code] = known[code].model_copy(update={"name": name})
        else:
            log.info("New institution: %s %s", code, name)
            known[code] = Institution(
                code=code, name=name, type=_guess_type(code, name), region=None
            )
    institutions = list(known.values())
    _write(path, _dump(institutions))
    return institutions


def _merge_sectors(path: Path, found: dict[str, str]) -> None:
    sectors = Sectors.model_validate_json(path.read_bytes())
    known_areas = {a.code for a in sectors.areas}
    known_groups = {g.code for g in sectors.groups}
    for value, label in found.items():
        area, _, code = value.partition("/")
        if not code:
            log.warning("Unexpected G.S.D. option ignored: %r", value)
            continue
        if area not in known_areas:
            log.warning("New area %s: add its names to sectors.json", area)
            sectors.areas.append(SectorArea(code=area, name=LocalizedText(it=area, en=area)))
            known_areas.add(area)
        if code not in known_groups:
            log.info("New G.S.D.: %s", label)
            name = label.split(" - ", 1)[-1].capitalize()
            sectors.groups.append(SectorGroup(code=code, area=area, name=name))
            known_groups.add(code)
    _write(path, sectors.model_dump())


def sync_reference(client: httpx.Client, reference_dir: Path) -> list[Institution]:
    """Refresh the tables in place; return the institutions that still need a region."""
    institutions, groups = _fetch_menus(client)
    merged = _merge_institutions(reference_dir / "institutions.json", institutions)
    _merge_sectors(reference_dir / "sectors.json", groups)
    return [i for i in merged if i.region is None and i.type != "research_institute"]
