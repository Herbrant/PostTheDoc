from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import respx

from postthedoc.sources.mur import SECTIONS, MurSource, parse_detail_page, parse_search_page

FIXTURES = Path(__file__).parent / "fixtures" / "mur"
SECTION = {s.key: s for s in SECTIONS}


def load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_parse_jobs():
    bandi = parse_search_page(load("jobs.html"), SECTION["jobs"])
    assert len(bandi) == 6
    b = bandi[1]
    assert b.id == "mur-jobs-151524"
    assert b.role == "ricercatore"
    assert b.url == "https://bandi.mur.gov.it/jobs.php/public/job/id_job/151524"
    assert b.title.startswith("n.1 posto di RICERCATORE a tempo determinato in tenure track")
    assert b.struttura_code == "UNIBS"
    assert b.regione == "lombardia"
    assert b.ssd == ["IIND-04/A"]
    assert b.gsd == ["IIND-04"]
    assert b.deadline == datetime(2026, 10, 1, 14, 0, tzinfo=ZoneInfo("Europe/Rome"))


def test_parse_html_entities_in_struttura():
    bandi = parse_search_page(load("jobs.html"), SECTION["jobs"])
    assert bandi[0].struttura_code == "UNIFI"
    assert bandi[0].ssd == ["MEDS-17/A"]


def test_parse_profcalls_role_from_qualifica():
    bandi = parse_search_page(load("profcalls.html"), SECTION["profcalls"])
    roles = {b.id: b.role for b in bandi}
    assert roles["mur-profcalls-152027"] == "professore_associato"
    assert roles["mur-profcalls-151844"] == "professore_ordinario"
    # la qualifica tra parentesi non fa parte del titolo
    assert all("(Professore" not in b.title for b in bandi)


def test_parse_multiple_ssd_and_posti():
    bandi = parse_search_page(load("incarichidiricerca.html"), SECTION["incarichidiricerca"])
    multi = next(b for b in bandi if b.id == "mur-incarichidiricerca-316344")
    assert multi.ssd == ["IIND-06/A", "IIND-06/B"]
    assert multi.gsd == ["IIND-06"]
    assert multi.posti == 1
    assert multi.role == "incarico_ricerca"


def test_parse_doctorate_without_sector():
    bandi = parse_search_page(load("doctorate.html"), SECTION["doctorate"])
    assert bandi[0].id == "mur-doctorate-316803"
    assert bandi[0].gsd == []
    assert bandi[0].posti == 1


def test_parse_detail_page():
    ssd, gsd = parse_detail_page(load("doctorate_detail_316803.html"))
    assert gsd == ["INFO-01"]
    assert ssd == []


@respx.mock
def test_source_fetch_and_enrich():
    section = SECTION["doctorate"]
    respx.get(section.search_url).mock(
        return_value=httpx.Response(200, text=load("doctorate.html"))
    )
    respx.get(url__startswith="https://bandi.mur.gov.it/doctorate.php/public/fellowship/").mock(
        return_value=httpx.Response(200, text=load("doctorate_detail_316803.html"))
    )
    source = MurSource(httpx.Client(), sections=(section,), detail_delay=0)

    bandi = source.fetch()
    source.enrich(bandi[:1])

    assert len(bandi) == 3
    assert bandi[0].gsd == ["INFO-01"]
    assert bandi[1].gsd == []  # non arricchito


@respx.mock
def test_source_skips_failing_section():
    respx.get(SECTION["jobs"].search_url).mock(return_value=httpx.Response(503))
    respx.get(SECTION["tecno"].search_url).mock(
        return_value=httpx.Response(200, text=load("tecno.html"))
    )
    source = MurSource(httpx.Client(), sections=(SECTION["jobs"], SECTION["tecno"]))

    bandi = source.fetch()

    assert {b.role for b in bandi} == {"tecnologo"}
