import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from postthedoc.maintenance.denominators import (
    NUTS2,
    RESIDENTS_URL,
    STAFF_URL,
    STUDENTS_URL,
    DenominatorError,
    build,
    parse_residents,
    parse_staff,
    parse_students,
    sync_denominators,
)
from postthedoc.reference import Institution

STAFF = (
    "ANNO;COD_ATENEO;NOME_ATENEO;Reg_ATENEO;AREA_GEO;GENERE;COD_QUALIFICA;DESC_QUALIFICA;N_PERS\n"
    "2025;08701;Catania - Università degli studi;Sicilia;ISOLE;F;1PO e 2PA;Prof;300\n"
    "2025;08701;Catania - Università degli studi;Sicilia;ISOLE;M;3RU e 3RTD;Ric;200\n"
    "2025;08701;Catania - Università degli studi;Sicilia;ISOLE;M;4AR/CR;Assegni;999\n"
    "2024;08701;Catania - Università degli studi;Sicilia;ISOLE;M;1PO e 2PA;Prof;1\n"
    "2025;05002;Pisa - Scuola normale superiore;Toscana;CENTRO;M;1PO e 2PA;Prof;50\n"
).encode("latin-1")
STUDENTS = (
    "AnnoA;AteneoNOME;AteneoCOD;SESSO;Iscritti\r\n"
    "2025/2026;Catania;8701;F;20000\r\n"
    "2025/2026;Catania;8701;M;15000\r\n"
    "2024/2025;Catania;8701;M;1\r\n"
).encode("latin-1")
UNICT = Institution(
    code="UNICT", name="Univ. CATANIA", type="university", region="IT-82", ustat="08701"
)
NORMALE = Institution(
    code="NORMALE", name="Sc. Norm.", type="university", region="IT-52", ustat="05002"
)
CNR = Institution(code="CNR", name="CNR", type="research_institute", region=None)


def residents_json(missing: str | None = None) -> dict[str, Any]:
    geo = {nuts: i for i, nuts in enumerate(NUTS2)}
    values = {}
    for nuts, i in geo.items():
        values[str(i * 2)] = 1000  # 2024
        if nuts != missing:
            values[str(i * 2 + 1)] = 2000  # 2025
    return {
        "dimension": {
            "geo": {"category": {"index": geo}},
            "time": {"category": {"index": {"2024": 0, "2025": 1}}},
        },
        "value": values,
    }


def test_staff_counts_professors_and_researchers_of_the_latest_year():
    assert parse_staff(STAFF) == ("2025", {"08701": 500, "05002": 50})


def test_students_of_the_latest_year_with_padded_codes():
    assert parse_students(STUDENTS) == ("2025/2026", {"08701": 35000})


def test_residents_sum_trentino_and_fall_back_to_a_complete_year():
    year, residents = parse_residents(residents_json())
    assert year == "2025"
    assert residents["IT-32"] == 4000  # Bolzano + Trento
    assert len(residents) == 20
    assert parse_residents(residents_json(missing="ITF2"))[0] == "2024"


def test_residents_without_any_complete_year():
    data = residents_json(missing="ITF2")
    data["value"] = {k: v for k, v in data["value"].items() if v != 1000}
    with pytest.raises(DenominatorError):
        parse_residents(data)


def test_build_matches_universities_through_their_ustat_code():
    data = build(
        [UNICT, NORMALE, CNR], parse_staff(STAFF), parse_students(STUDENTS), ("2025", {"IT-82": 9})
    )
    assert data["universities"] == {
        "NORMALE": {"staff": 50, "students": None},  # special schools have no enrolled students
        "UNICT": {"staff": 500, "students": 35000},
    }
    assert data["regions"] == {"IT-82": {"residents": 9}}
    assert [s["period"] for s in data["sources"]] == ["2025", "2025/2026", "2025"]


def test_build_fails_when_a_university_has_no_staff_figure():
    lost = Institution(code="LOST", name="Lost", type="university", region=None, ustat="99999")
    with pytest.raises(DenominatorError, match="LOST"):
        build([lost], parse_staff(STAFF), parse_students(STUDENTS), ("2025", {}))


@respx.mock
def test_sync_writes_the_file_and_retries(tmp_path: Path):
    respx.get(STAFF_URL).mock(
        side_effect=[httpx.RemoteProtocolError("empty"), httpx.Response(200, content=STAFF)]
    )
    respx.get(STUDENTS_URL).mock(return_value=httpx.Response(200, content=STUDENTS))
    respx.get(url__startswith=RESIDENTS_URL).mock(
        return_value=httpx.Response(200, json=residents_json())
    )

    path = sync_denominators(httpx.Client(), tmp_path, [UNICT], sleep=lambda _: None)

    data = json.loads(path.read_text())
    assert data["universities"] == {"UNICT": {"staff": 500, "students": 35000}}


@respx.mock
def test_sync_gives_up_after_the_attempts(tmp_path: Path):
    respx.get(STAFF_URL).mock(return_value=httpx.Response(503))
    with pytest.raises(DenominatorError, match="503"):
        sync_denominators(httpx.Client(), tmp_path, [UNICT], sleep=lambda _: None)
