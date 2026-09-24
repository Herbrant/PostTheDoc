"""Reference tables shared with the Worker (data/reference/*.json)."""

import json
import os
from functools import cache
from pathlib import Path
from typing import Any

from postthedoc.models import Locale

DATA_DIR = Path(os.environ.get("POSTTHEDOC_DATA", Path(__file__).resolve().parents[4] / "data"))
REFERENCE_DIR = DATA_DIR / "reference"


def _load(name: str) -> Any:
    return json.loads((REFERENCE_DIR / name).read_text(encoding="utf-8"))


def _normalize(name: str) -> str:
    return " ".join(name.split()).casefold()


@cache
def institutions() -> list[dict]:
    return _load("institutions.json")


@cache
def _institutions_by_name() -> dict[str, dict]:
    return {_normalize(i["name"]): i for i in institutions()}


def find_institution(name: str) -> dict | None:
    """Look up an institution by name, as it appears in bandi.mur.gov.it results."""
    return _institutions_by_name().get(_normalize(name))


@cache
def gsd_codes() -> frozenset[str]:
    return frozenset(g["code"] for g in _load("sectors.json")["groups"])


@cache
def _roles() -> list[dict]:
    return _load("roles.json")


def role_names(locale: Locale) -> dict[str, str]:
    """Role code -> localized name, in display order."""
    return {r["code"]: r["name"][locale] for r in _roles()}


@cache
def _regions() -> list[dict]:
    return _load("regions.json")


def region_names(locale: Locale) -> dict[str, str]:
    return {r["code"]: r["name"][locale] for r in _regions()}
