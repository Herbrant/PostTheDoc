import json
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.maintenance.geometry import (
    NOMINATIM_URL,
    REGIONS_URL,
    GeometryError,
    area,
    regions,
    simplify,
    sync_geometry,
)
from postthedoc.reference import Institution

SQUARE = [(10.0, 40.0), (11.0, 40.0), (11.0, 41.0), (10.0, 41.0), (10.0, 40.0)]
TINY = [(12.0, 40.0), (12.01, 40.0), (12.01, 40.01), (12.0, 40.01), (12.0, 40.0)]
GEOJSON = {
    "features": [
        {
            "properties": {"reg_iso_3166_2": "IT-82"},
            "geometry": {"type": "MultiPolygon", "coordinates": [[SQUARE], [TINY]]},
        },
        {
            "properties": {"reg_iso_3166_2": "IT-21"},
            "geometry": {"type": "Polygon", "coordinates": [SQUARE]},
        },
    ]
}
UNICT = Institution(
    code="UNICT", name="Univ. CATANIA", type="university", region="IT-82", ustat="08701"
)
PEGASO = Institution(
    code="PEGASO", name="Pegaso", type="online_university", region="IT-72", ustat="06307"
)


def test_simplify_drops_points_within_the_tolerance():
    line = [(0.0, 0.0), (1.0, 0.001), (2.0, 0.0), (3.0, 1.0)]
    assert simplify(line, 0.01) == [(0.0, 0.0), (2.0, 0.0), (3.0, 1.0)]
    assert simplify(line[:2], 0.01) == line[:2]


def test_area():
    assert area(SQUARE) == pytest.approx(1.0)


def test_regions_leave_out_small_islands_and_sort():
    result = regions(GEOJSON)
    assert list(result) == ["IT-21", "IT-82"]
    assert len(result["IT-82"]) == 1  # the tiny island is gone


@respx.mock
def test_sync_geocodes_new_cities_only(tmp_path: Path):
    respx.get(REGIONS_URL).mock(return_value=httpx.Response(200, json=GEOJSON))
    nominatim = respx.get(url__startswith=NOMINATIM_URL).mock(
        return_value=httpx.Response(200, json=[{"lon": "15.0871", "lat": "37.5023"}])
    )

    path = sync_geometry(httpx.Client(), tmp_path, [UNICT, PEGASO], sleep=lambda _: None)
    data = json.loads(path.read_text())
    assert data["cities"] == {"Catania": [15.087, 37.502]}
    assert data["universities"] == {"UNICT": "Catania"}  # online universities have no place
    assert nominatim.calls[0].request.url.params["city"] == "Catania"

    sync_geometry(httpx.Client(), tmp_path, [UNICT], sleep=lambda _: None)
    assert nominatim.call_count == 1  # kept from the first run


@respx.mock
def test_sync_errors(tmp_path: Path):
    respx.get(REGIONS_URL).mock(return_value=httpx.Response(200, json=GEOJSON))
    respx.get(url__startswith=NOMINATIM_URL).mock(return_value=httpx.Response(200, json=[]))
    nowhere = Institution(code="NOWHERE", name="?", type="university", region=None, ustat="1")
    with pytest.raises(GeometryError, match="NOWHERE"):
        sync_geometry(httpx.Client(), tmp_path, [nowhere], sleep=lambda _: None)
    with pytest.raises(GeometryError, match="not found"):
        sync_geometry(httpx.Client(), tmp_path, [UNICT], sleep=lambda _: None)


@respx.mock
def test_sync_reports_unreachable_sources(tmp_path: Path):
    respx.get(REGIONS_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(GeometryError):
        sync_geometry(httpx.Client(), tmp_path, [UNICT], sleep=lambda _: None)
    respx.get(REGIONS_URL).mock(return_value=httpx.Response(200, json=GEOJSON))
    respx.get(url__startswith=NOMINATIM_URL).mock(return_value=httpx.Response(429))
    with pytest.raises(GeometryError, match="429"):
        sync_geometry(httpx.Client(), tmp_path, [UNICT], sleep=lambda _: None)
