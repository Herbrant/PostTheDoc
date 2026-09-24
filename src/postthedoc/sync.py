"""Aggiorna data/reference/{strutture,settori}.json leggendo i menu di ricerca di bandi.mur.gov.it.

Le regioni delle nuove strutture vanno completate a mano: il portale non le espone.
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


def _guess_tipo(code: str, name: str) -> str:
    if name.startswith("CNR") or "Istituto" in name:
        return "ente_ricerca"
    if code.startswith(("ABA", "CDM", "ISSM", "ISIA")):
        return "afam"
    if "Telemat" in name:
        return "universita_telematica"
    return "universita"


def sync_reference(client: httpx.Client, reference_dir: Path) -> list[dict]:
    """Restituisce le strutture ancora prive di regione."""
    found: dict[str, str] = {}
    gsd: dict[str, str] = {}
    for section in SECTIONS:
        resp = client.get(section.search_url)
        resp.raise_for_status()
        tree = HTMLParser(resp.text)
        for code, name in _options(tree, "bb_type_code").items():
            found.setdefault(code, name)
        gsd.update(_options(tree, "idgsd24"))

    strutture_path = reference_dir / "strutture.json"
    strutture = {s["code"]: s for s in json.loads(strutture_path.read_text(encoding="utf-8"))}
    for code, name in found.items():
        if code in strutture:
            strutture[code]["name"] = name
        else:
            log.info("Nuova struttura: %s %s", code, name)
            strutture[code] = {
                "code": code,
                "name": name,
                "tipo": _guess_tipo(code, name),
                "regione": None,
            }
    strutture_path.write_text(
        json.dumps(list(strutture.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    settori_path = reference_dir / "settori.json"
    settori = json.loads(settori_path.read_text(encoding="utf-8"))
    known = {g["code"] for g in settori["gsd"]}
    for value, label in gsd.items():
        area, code = value.split("/", 1)
        if code not in known:
            log.info("Nuovo G.S.D.: %s", label)
            name = label.split(" - ", 1)[-1].capitalize()
            settori["gsd"].append({"code": code, "area": area, "name": name})
    settori_path.write_text(
        json.dumps(settori, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    return [s for s in strutture.values() if s["regione"] is None and s["tipo"] != "ente_ricerca"]
