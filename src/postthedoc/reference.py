"""Tabelle di riferimento condivise con il Worker (data/reference/*.json)."""

import json
import os
from functools import cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("POSTTHEDOC_DATA", Path(__file__).resolve().parents[2] / "data"))
REFERENCE_DIR = DATA_DIR / "reference"


def _load(name: str) -> Any:
    return json.loads((REFERENCE_DIR / name).read_text(encoding="utf-8"))


def _normalize(name: str) -> str:
    return " ".join(name.split()).casefold()


@cache
def strutture() -> list[dict]:
    return _load("strutture.json")


@cache
def _strutture_by_name() -> dict[str, dict]:
    return {_normalize(s["name"]): s for s in strutture()}


def find_struttura(name: str) -> dict | None:
    """Cerca una struttura per nome, così come compare nei risultati di bandi.mur.gov.it."""
    return _strutture_by_name().get(_normalize(name))


@cache
def gsd_codes() -> frozenset[str]:
    return frozenset(g["code"] for g in _load("settori.json")["gsd"])


@cache
def role_names() -> dict[str, str]:
    return {r["code"]: r["name"] for r in _load("ruoli.json")}


@cache
def region_names() -> dict[str, str]:
    return {r["code"]: r["name"] for r in _load("regioni.json")}
