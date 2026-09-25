from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pytest
import respx

from postthedoc.reference import ReferenceData
from postthedoc.sources.mur import SECTIONS_BY_KEY as SECTION
from postthedoc.sources.mur import LayoutError, MurParser, MurSource, parse_detail_page
from tests.factories import make_call


@pytest.fixture
def parser(reference: ReferenceData) -> MurParser:
    return MurParser(reference)


@pytest.fixture
def load(fixtures: Path):
    return lambda name: (fixtures / "mur" / name).read_text(encoding="utf-8")


def test_parse_jobs(parser, load):
    calls = parser.parse_search_page(load("jobs.html"), SECTION["jobs"])
    assert len(calls) == 6
    call = calls[1]
    assert call.id == "mur-jobs-151524"
    assert call.source == "mur"
    assert call.role == "researcher"
    assert call.url == "https://bandi.mur.gov.it/jobs.php/public/job/id_job/151524"
    assert call.title.startswith("n.1 posto di RICERCATORE a tempo determinato in tenure track")
    assert call.institution_code == "UNIBS"
    assert call.region == "IT-25"
    assert call.ssd == ["IIND-04/A"]
    assert call.gsd == ["IIND-04"]
    assert call.deadline == datetime(2026, 10, 1, 14, 0, tzinfo=ZoneInfo("Europe/Rome"))


@pytest.mark.parametrize(
    "href",
    [
        "javascript:alert(1)//id_job/1",
        "https://evil.example/jobs.php/public/job/id_job/1",
        "//evil.example/id_job/1",
    ],
)
def test_ignores_links_outside_the_portal(parser, href):
    assert parser.parse_search_page(result_page(href), SECTION["jobs"]) == []


def test_resolves_relative_links(parser):
    [call] = parser.parse_search_page(result_page("/jobs.php/public/job/id_job/1"), SECTION["jobs"])
    assert call.url == "https://bandi.mur.gov.it/jobs.php/public/job/id_job/1"
    assert call.deadline == datetime(2026, 10, 1, 23, 59, tzinfo=ZoneInfo("Europe/Rome"))


def result_page(href: str) -> str:
    return f"""<h2 class="risultato">Risultato della ricerca bandi - trovati 1 bandi</h2>
    <div id="hiddenresult"><div class="result"><p>
        <em class="aperto"> scade il 01/10/2026</em><br />
        <strong>Univ. FIRENZE</strong><br />
        Titolo: <a href="{href}">Bando</a><br />
    </p></div></div>"""


def test_parse_page_without_results(parser):
    page = """<h2 class="risultato">Risultato della ricerca bandi</h2>
    <div style="color: red;">Non sono presenti bandi per i criteri di ricerca selezionati.</div>
    <h2 class="risultato">Riepilogo bandi nel sistema - Totale bandi aperti: 0</h2>"""
    assert parser.parse_search_page(page, SECTION["jobs"]) == []


def test_count_mismatch_is_a_layout_error(parser, load):
    page = load("jobs.html").replace("trovati 6 bandi", "trovati 7 bandi")
    with pytest.raises(LayoutError, match="reports 7 results, 6 found"):
        parser.parse_search_page(page, SECTION["jobs"])


def test_missing_count_is_a_layout_error(parser):
    page = result_page("/jobs.php/public/job/id_job/1").replace("trovati 1 bandi", "")
    with pytest.raises(LayoutError, match="count not found"):
        parser.parse_search_page(page, SECTION["jobs"])


def test_parse_html_entities_in_institution(parser, load):
    calls = parser.parse_search_page(load("jobs.html"), SECTION["jobs"])
    assert calls[0].institution_code == "UNIFI"
    assert calls[0].ssd == ["MEDS-17/A"]


def test_parse_profcalls_role_from_qualification(parser, load):
    calls = parser.parse_search_page(load("profcalls.html"), SECTION["profcalls"])
    roles = {c.id: c.role for c in calls}
    assert roles["mur-profcalls-152027"] == "associate_professor"
    assert roles["mur-profcalls-151844"] == "full_professor"
    # the qualification in parentheses is not part of the title
    assert all("(Professore" not in c.title for c in calls)


def test_parse_multiple_ssd_and_positions(parser, load):
    calls = parser.parse_search_page(load("incarichidiricerca.html"), SECTION["incarichidiricerca"])
    multi = next(c for c in calls if c.id == "mur-incarichidiricerca-316344")
    assert multi.ssd == ["IIND-06/A", "IIND-06/B"]
    assert multi.gsd == ["IIND-06"]
    assert multi.positions == 1
    assert multi.role == "research_fellowship"


def test_parse_doctorate_without_sector(parser, load):
    calls = parser.parse_search_page(load("doctorate.html"), SECTION["doctorate"])
    assert calls[0].id == "mur-doctorate-316803"
    assert calls[0].role == "phd"
    assert calls[0].gsd == []
    assert calls[0].positions == 1


def test_parse_detail_page(load):
    ssd, gsd = parse_detail_page(load("doctorate_detail_316803.html"))
    assert gsd == ["INFO-01"]
    assert ssd == []


@respx.mock
def test_source_fetch_and_enrich(reference, load):
    section = SECTION["doctorate"]
    respx.get(section.search_url).mock(
        return_value=httpx.Response(200, text=load("doctorate.html"))
    )
    respx.get(url__startswith="https://bandi.mur.gov.it/doctorate.php/public/fellowship/").mock(
        return_value=httpx.Response(200, text=load("doctorate_detail_316803.html"))
    )
    source = MurSource(httpx.Client(), reference, sections=[section], detail_delay=0)

    result = source.fetch()
    source.enrich(result.calls[:1])

    assert result.failures == []
    assert len(result.calls) == 3
    assert result.calls[0].gsd == ["INFO-01"]
    assert result.calls[1].gsd == []  # not enriched


@respx.mock
def test_source_reports_failing_sections(reference, load):
    respx.get(SECTION["jobs"].search_url).mock(return_value=httpx.Response(503))
    respx.get(SECTION["tecno"].search_url).mock(
        return_value=httpx.Response(200, text=load("tecno.html"))
    )
    source = MurSource(httpx.Client(), reference, sections=[SECTION["jobs"], SECTION["tecno"]])

    result = source.fetch()

    assert {c.role for c in result.calls} == {"technologist"}
    assert result.failures == ["mur/jobs"]


@respx.mock
def test_source_reports_sections_with_unexpected_pages(reference, load):
    respx.get(SECTION["jobs"].search_url).mock(
        return_value=httpx.Response(200, text="<html><body>Manutenzione</body></html>")
    )
    respx.get(SECTION["tecno"].search_url).mock(
        return_value=httpx.Response(200, text=load("tecno.html"))
    )
    source = MurSource(httpx.Client(), reference, sections=[SECTION["jobs"], SECTION["tecno"]])

    result = source.fetch()

    assert {c.role for c in result.calls} == {"technologist"}
    assert result.failures == ["mur/jobs"]


@respx.mock
def test_enrich_skips_unavailable_detail_pages(reference):
    respx.get("https://example.org/mur-doctorate-1").mock(return_value=httpx.Response(500))
    source = MurSource(httpx.Client(), reference, detail_delay=0)
    call = make_call("mur-doctorate-1", url="https://example.org/mur-doctorate-1", gsd=[], ssd=[])
    source.enrich([call])
    assert call.gsd == []
