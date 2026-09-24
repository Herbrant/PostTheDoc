"""Update data/reference/{institutions,sectors}.json from the bandi.mur.gov.it search menus.

Regions of new institutions must be filled in by hand: the portal does not expose them.
"""

import json
import logging
from pathlib import Path

import httpx
from selectolax.parser import HTMLParser

from postthedoc.sources.mur import SECTIONS

log = logging.getLogger(__name__)


def _options(tree: HTMLParser, select_name: str) -> dict[str, str]:
    return {
        value: " ".join(opt.text().split())
        for opt in tree.css(f'select[name="{select_name}"] option')
        if (value := opt.attributes.get("value")) and value != "%"
    }


def _guess_type(code: str, name: str) -> str:
    if name.startswith("CNR") or "Istituto" in name:
        return "research_institute"
    if code.startswith(("ABA", "CDM", "ISSM", "ISIA")):
        return "afam"
    if "Telemat" in name:
        return "online_university"
    return "university"


def _write(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync_reference(client: httpx.Client, reference_dir: Path) -> list[dict]:
    """Return the institutions that still have no region."""
    found: dict[str, str] = {}
    groups: dict[str, str] = {}
    for section in SECTIONS:
        resp = client.get(section.search_url)
        resp.raise_for_status()
        tree = HTMLParser(resp.text)
        for code, name in _options(tree, "bb_type_code").items():
            found.setdefault(code, name)
        groups.update(_options(tree, "idgsd24"))

    institutions_path = reference_dir / "institutions.json"
    institutions = {i["code"]: i for i in json.loads(institutions_path.read_text(encoding="utf-8"))}
    for code, name in found.items():
        if code in institutions:
            institutions[code]["name"] = name
        else:
            log.info("New institution: %s %s", code, name)
            institutions[code] = {
                "code": code,
                "name": name,
                "type": _guess_type(code, name),
                "region": None,
            }
    _write(institutions_path, list(institutions.values()))

    sectors_path = reference_dir / "sectors.json"
    sectors = json.loads(sectors_path.read_text(encoding="utf-8"))
    known_groups = {g["code"] for g in sectors["groups"]}
    known_areas = {a["code"] for a in sectors["areas"]}
    for value, label in groups.items():
        area, code = value.split("/", 1)
        if area not in known_areas:
            log.warning("New area %s: add its names to sectors.json", area)
            sectors["areas"].append({"code": area, "name": {"it": area, "en": area}})
            known_areas.add(area)
        if code not in known_groups:
            log.info("New G.S.D.: %s", label)
            name = label.split(" - ", 1)[-1].capitalize()
            sectors["groups"].append({"code": code, "area": area, "name": name})
    _write(sectors_path, sectors)

    return [
        i
        for i in institutions.values()
        if i["region"] is None and i["type"] != "research_institute"
    ]
