"""Update data/reference/denominators.json: the sizes the observatory divides the positions by.

- permanent teaching and research staff of each university (professors and researchers, USTAT);
- students enrolled at each university (USTAT, latest academic year);
- residents of each region (ISTAT, through Eurostat's API, which answers reliably).

Universities are matched through the "ustat" codes of data/reference/institutions.json, checked
by hand. Run it once a year, when the sources publish new figures.
"""

import csv
import io
import json
import logging
import time
from collections import defaultdict
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

import httpx

from postthedoc.reference import Institution

log = logging.getLogger(__name__)

STAFF_URL = (
    "https://dati-ustat.mur.gov.it/dataset/28d258e4-85b2-43e8-b74f-ed2392ef16db/resource/"
    "eceaccb5-d130-4d60-a531-5a4f74b293a6/download/personale_xgenere.csv"
)
STUDENTS_URL = (
    "https://dati-ustat.mur.gov.it/dataset/3dd9ca7f-9cc9-4a1a-915c-e569b181dbd5/resource/"
    "32d26e28-a0b5-45f3-9152-6072164f3e63/download/02_iscrittixateneo.csv"
)
RESIDENTS_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_r_d2jan"
# Professors (full and associate) and researchers (permanent and fixed-term): research
# fellows and contract lecturers are what the calls recruit, not the size of the university.
STAFF_QUALIFICATIONS = ("1PO e 2PA", "3RU e 3RTD")
# NUTS 2 regions -> ISO 3166-2: Trentino-Alto Adige is two NUTS 2 regions (Bolzano, Trento).
NUTS2 = {
    "ITC1": "IT-21",
    "ITC2": "IT-23",
    "ITC3": "IT-42",
    "ITC4": "IT-25",
    "ITH1": "IT-32",
    "ITH2": "IT-32",
    "ITH3": "IT-34",
    "ITH4": "IT-36",
    "ITH5": "IT-45",
    "ITI1": "IT-52",
    "ITI2": "IT-55",
    "ITI3": "IT-57",
    "ITI4": "IT-62",
    "ITF1": "IT-65",
    "ITF2": "IT-67",
    "ITF3": "IT-72",
    "ITF4": "IT-75",
    "ITF5": "IT-77",
    "ITF6": "IT-78",
    "ITG1": "IT-82",
    "ITG2": "IT-88",
}
# The USTAT server drops connections now and then.
ATTEMPTS = 4
BACKOFF_SECONDS = 5.0


class DenominatorError(Exception):
    """A source could not be read, or does not cover every university."""


def _get(
    client: httpx.Client,
    url: str,
    params: dict[str, Any] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> httpx.Response:
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return client.get(url, params=params).raise_for_status()
        except httpx.HTTPError as exc:
            if attempt == ATTEMPTS:
                raise DenominatorError(f"{url}: {exc}") from exc
            log.warning("%s: %s, retrying", url, exc)
            sleep(BACKOFF_SECONDS * attempt)
    raise AssertionError("unreachable")


def _rows(content: bytes) -> list[dict[str, str]]:
    """USTAT's CSV files: ';'-separated, in Latin-1."""
    return list(csv.DictReader(io.StringIO(content.decode("latin-1")), delimiter=";"))


def _ustat_code(code: str) -> str:
    """USTAT codes are written with or without leading zeros, depending on the file."""
    return code.strip().zfill(5)


def parse_staff(content: bytes) -> tuple[str, dict[str, int]]:
    """(year, USTAT code -> permanent teaching and research staff) of the latest year."""
    rows = _rows(content)
    year = max(row["ANNO"] for row in rows)
    staff: dict[str, int] = defaultdict(int)
    for row in rows:
        if row["ANNO"] == year and row["COD_QUALIFICA"] in STAFF_QUALIFICATIONS:
            staff[_ustat_code(row["COD_ATENEO"])] += int(row["N_PERS"])
    return year, dict(staff)


def parse_students(content: bytes) -> tuple[str, dict[str, int]]:
    """(academic year, USTAT code -> enrolled students) of the latest academic year."""
    rows = _rows(content)
    year = max(row["AnnoA"] for row in rows)
    students: dict[str, int] = defaultdict(int)
    for row in rows:
        if row["AnnoA"] == year:
            students[_ustat_code(row["AteneoCOD"])] += int(row["Iscritti"])
    return year, dict(students)


def parse_residents(data: dict[str, Any]) -> tuple[str, dict[str, int]]:
    """(year, region -> residents on 1 January) of the latest year, from Eurostat's JSON-stat."""
    geo: dict[str, int] = data["dimension"]["geo"]["category"]["index"]
    times: dict[str, int] = data["dimension"]["time"]["category"]["index"]
    values: dict[str, int] = data["value"]
    for year in sorted(times, reverse=True):
        found = {
            nuts: values.get(str(index * len(times) + times[year])) for nuts, index in geo.items()
        }
        if all(found.get(nuts) is not None for nuts in NUTS2):
            residents: dict[str, int] = defaultdict(int)
            for nuts, region in NUTS2.items():
                residents[region] += int(found[nuts] or 0)
            return year, dict(residents)
    raise DenominatorError("Eurostat has no year with every Italian region")


def build(
    institutions: Iterable[Institution],
    staff: tuple[str, dict[str, int]],
    students: tuple[str, dict[str, int]],
    residents: tuple[str, dict[str, int]],
) -> dict[str, Any]:
    """The contents of denominators.json. Raise DenominatorError if a university with a USTAT
    code has no staff figure: its calls would silently drop out of the comparisons.

    Students may be missing: the special schools (Scuola Normale, SISSA, ...) train mostly
    PhD students and are not among USTAT's enrolled students, so they have no student rate.
    """
    universities: dict[str, dict[str, int | None]] = {}
    missing = []
    for institution in sorted(institutions, key=lambda i: i.code):
        if institution.ustat is None:
            continue
        code = institution.ustat
        if code not in staff[1]:
            missing.append(f"{institution.code} ({code})")
            continue
        universities[institution.code] = {
            "staff": staff[1][code],
            "students": students[1].get(code),
        }
    if missing:
        raise DenominatorError(f"Missing from USTAT's staff: {', '.join(missing)}")
    if no_students := [code for code, n in universities.items() if n["students"] is None]:
        log.info("No enrolled students (special schools?): %s", ", ".join(no_students))
    return {
        "sources": [
            {
                "measure": "staff",
                "description": "Professors and researchers (permanent and fixed-term)",
                "source": "MUR - USTAT, Personale universitario",
                "url": STAFF_URL,
                "license": "IODL-2.0",
                "period": staff[0],
            },
            {
                "measure": "students",
                "description": "Students enrolled",
                "source": "MUR - USTAT, Iscritti per ateneo",
                "url": STUDENTS_URL,
                "license": "IODL-2.0",
                "period": students[0],
            },
            {
                "measure": "residents",
                "description": "Residents on 1 January",
                "source": "ISTAT, via Eurostat (demo_r_d2jan)",
                "url": RESIDENTS_URL,
                "license": "CC-BY-4.0",
                "period": residents[0],
            },
        ],
        "universities": universities,
        "regions": {region: {"residents": n} for region, n in sorted(residents[1].items())},
    }


def sync_denominators(
    client: httpx.Client,
    reference_dir: Path,
    institutions: Iterable[Institution],
    sleep: Callable[[float], None] = time.sleep,
) -> Path:
    staff = parse_staff(_get(client, STAFF_URL, sleep=sleep).content)
    students = parse_students(_get(client, STUDENTS_URL, sleep=sleep).content)
    params = {"format": "JSON", "sex": "T", "age": "TOTAL", "unit": "NR", "geo": list(NUTS2)}
    residents = parse_residents(_get(client, RESIDENTS_URL, params, sleep=sleep).json())
    data = build(institutions, staff, students, residents)
    path = reference_dir / "denominators.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log.info(
        "Denominators: %d universities (staff %s, students %s), residents %s",
        len(data["universities"]),
        staff[0],
        students[0],
        residents[0],
    )
    return path
