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
    calls = parse_search_page(load("jobs.html"), SECTION["jobs"])
    assert len(calls) == 6
    c = calls[1]
    assert c.id == "mur-jobs-151524"
    assert c.role == "researcher"
    assert c.url == "https://bandi.mur.gov.it/jobs.php/public/job/id_job/151524"
    assert c.title.startswith("n.1 posto di RICERCATORE a tempo determinato in tenure track")
    assert c.institution_code == "UNIBS"
    assert c.region == "IT-25"
    assert c.ssd == ["IIND-04/A"]
    assert c.gsd == ["IIND-04"]
    assert c.deadline == datetime(2026, 10, 1, 14, 0, tzinfo=ZoneInfo("Europe/Rome"))


def test_ignores_links_outside_the_portal():
    result = """<div id="hiddenresult"><div class="result"><p>
        <em class="aperto"> scade il 01/10/2026</em><br />
        <strong>Univ. FIRENZE</strong><br />
        Titolo: <a href="{}">Bando</a><br />
    </p></div></div>"""
    for href in (
        "javascript:alert(1)//id_job/1",
        "https://evil.example/jobs.php/public/job/id_job/1",
        "//evil.example/id_job/1",
    ):
        assert parse_search_page(result.format(href), SECTION["jobs"]) == []
    [call] = parse_search_page(result.format("/jobs.php/public/job/id_job/1"), SECTION["jobs"])
    assert call.url == "https://bandi.mur.gov.it/jobs.php/public/job/id_job/1"


def test_parse_html_entities_in_institution():
    calls = parse_search_page(load("jobs.html"), SECTION["jobs"])
    assert calls[0].institution_code == "UNIFI"
    assert calls[0].ssd == ["MEDS-17/A"]


def test_parse_profcalls_role_from_qualification():
    calls = parse_search_page(load("profcalls.html"), SECTION["profcalls"])
    roles = {c.id: c.role for c in calls}
    assert roles["mur-profcalls-152027"] == "associate_professor"
    assert roles["mur-profcalls-151844"] == "full_professor"
    # the qualification in parentheses is not part of the title
    assert all("(Professore" not in c.title for c in calls)


def test_parse_multiple_ssd_and_positions():
    calls = parse_search_page(load("incarichidiricerca.html"), SECTION["incarichidiricerca"])
    multi = next(c for c in calls if c.id == "mur-incarichidiricerca-316344")
    assert multi.ssd == ["IIND-06/A", "IIND-06/B"]
    assert multi.gsd == ["IIND-06"]
    assert multi.positions == 1
    assert multi.role == "research_fellowship"


def test_parse_doctorate_without_sector():
    calls = parse_search_page(load("doctorate.html"), SECTION["doctorate"])
    assert calls[0].id == "mur-doctorate-316803"
    assert calls[0].role == "phd"
    assert calls[0].gsd == []
    assert calls[0].positions == 1


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

    calls = source.fetch()
    source.enrich(calls[:1])

    assert len(calls) == 3
    assert calls[0].gsd == ["INFO-01"]
    assert calls[1].gsd == []  # not enriched


@respx.mock
def test_source_skips_failing_section():
    respx.get(SECTION["jobs"].search_url).mock(return_value=httpx.Response(503))
    respx.get(SECTION["tecno"].search_url).mock(
        return_value=httpx.Response(200, text=load("tecno.html"))
    )
    source = MurSource(httpx.Client(), sections=(SECTION["jobs"], SECTION["tecno"]))

    calls = source.fetch()

    assert {c.role for c in calls} == {"technologist"}
