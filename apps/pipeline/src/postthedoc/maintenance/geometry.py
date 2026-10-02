"""Update data/reference/geometry.json: the observatory's map of Italy.

- region boundaries from openpolis/geojson-italy (ISTAT boundaries, CC BY 4.0), simplified
  (Douglas-Peucker) and rounded, small islands left out: a map to read, not to measure;
- the city of each university, geocoded once with OpenStreetMap's Nominatim (ODbL) and kept:
  later runs only geocode new cities. Online universities have no place on the map.
"""

import json
import logging
import math
import time
from collections.abc import Callable, Iterable, Sequence
from pathlib import Path
from typing import Any

import httpx

from postthedoc.reference import Institution

log = logging.getLogger(__name__)

REGIONS_URL = (
    "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/"
    "limits_IT_regions.geojson"
)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_DELAY_SECONDS = 1.1  # the service's limit is one request per second
TOLERANCE = 0.005  # degrees, about 500 m: invisible at the size the map is drawn
MIN_RING_AREA = 0.004  # square degrees, about 35 km²: smaller islands are left out
DECIMALS = 3

type Point = tuple[float, float]
type Ring = list[Point]

# Where each university is, as in MUR's statistics (USTAT): online universities are left out.
CITIES = {
    "BOCCONI": "Milano",
    "CAMPUS": "Roma",
    "CASD": "Roma",
    "EUROPEA": "Roma",
    "IMT": "Lucca",
    "IUAV": "Venezia",
    "IULM": "Milano",
    "IUSS": "Pavia",
    "LINKRM": "Roma",
    "LIUC": "Castellanza",
    "LUISS": "Roma",
    "LUM": "Casamassima",
    "LUMSA": "Roma",
    "LUSPIO": "Roma",
    "MARCHE": "Ancona",
    "NAORIEN": "Napoli",
    "NAPARTH": "Napoli",
    "NASORS": "Napoli",
    "NORMALE": "Pisa",
    "POLIBA": "Bari",
    "POLIMI": "Milano",
    "POLITO": "Torino",
    "RMFORO": "Roma",
    "ROMA1": "Roma",
    "ROMA2": "Roma",
    "ROMA3": "Roma",
    "SANNA": "Pisa",
    "SANNIO": "Benevento",
    "SANRAFMI": "Milano",
    "SCGA": "Bra",
    "SISSA": "Trieste",
    "STRAPG": "Perugia",
    "STRARC": "Reggio Calabria",
    "STRASI": "Siena",
    "TUSCIA": "Viterbo",
    "UICAM": "Camerino",
    "UKE": "Enna",
    "UNIAQ": "L'Aquila",
    "UNIBA": "Bari",
    "UNIBAS": "Potenza",
    "UNIBG": "Bergamo",
    "UNIBO": "Bologna",
    "UNIBS": "Brescia",
    "UNIBZ": "Bolzano",
    "UNICA": "Cagliari",
    "UNICAL": "Rende",
    "UNICAS": "Cassino",
    "UNICATT": "Milano",
    "UNICH": "Chieti",
    "UNICML": "Roma",
    "UNICT": "Catania",
    "UNICZ": "Catanzaro",
    "UNIFE": "Ferrara",
    "UNIFG": "Foggia",
    "UNIFI": "Firenze",
    "UNIGE": "Genova",
    "UNIGSSI": "L'Aquila",
    "UNIHUM": "Rozzano",
    "UNILE": "Lecce",
    "UNIMC": "Macerata",
    "UNIME": "Messina",
    "UNIMED": "Reggio Calabria",
    "UNIMI": "Milano",
    "UNIMIB": "Milano",
    "UNIMOL": "Campobasso",
    "UNIMORE": "Modena",
    "UNINA": "Napoli",
    "UNINA2": "Napoli",
    "UNINS": "Varese",
    "UNIPA": "Palermo",
    "UNIPD": "Padova",
    "UNIPG": "Perugia",
    "UNIPI": "Pisa",
    "UNIPMN": "Vercelli",
    "UNIPR": "Parma",
    "UNIPU": "Urbino",
    "UNIPV": "Pavia",
    "UNISA": "Salerno",
    "UNISI": "Siena",
    "UNISS": "Sassari",
    "UNISSME": "Napoli",
    "UNITE": "Teramo",
    "UNITN": "Trento",
    "UNITO": "Torino",
    "UNITS": "Trieste",
    "UNIUD": "Udine",
    "UNIVE": "Venezia",
    "UNIVR": "Verona",
    "VDA": "Aosta",
}


class GeometryError(Exception):
    """A source could not be read, or a university has no place."""


def _perpendicular(p: Point, a: Point, b: Point) -> float:
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)


def simplify(points: Sequence[Point], tolerance: float) -> Ring:
    """Douglas-Peucker, iterative (rings have thousands of points)."""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        far, index = 0.0, start
        for i in range(start + 1, end):
            d = _perpendicular(points[i], points[start], points[end])
            if d > far:
                far, index = d, i
        if far > tolerance:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [p for p, k in zip(points, keep, strict=True) if k]


def area(ring: Sequence[Point]) -> float:
    """Unsigned shoelace area, in square degrees."""
    return abs(
        sum(
            x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, [*ring[1:], ring[0]], strict=True)
        )
        / 2
    )


def regions(geojson: dict[str, Any]) -> dict[str, list[Ring]]:
    """ISO 3166-2 code -> outer rings, simplified and rounded (holes dropped: none matter)."""
    result: dict[str, list[Ring]] = {}
    for feature in geojson["features"]:
        geometry = feature["geometry"]
        polygons = (
            [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        )
        rings = []
        for polygon in polygons:
            outer = [(float(x), float(y)) for x, y, *_ in polygon[0]]
            if area(outer) < MIN_RING_AREA:
                continue
            ring = [(round(x, DECIMALS), round(y, DECIMALS)) for x, y in simplify(outer, TOLERANCE)]
            if len(ring) >= 4:
                rings.append(ring)
        result[feature["properties"]["reg_iso_3166_2"]] = rings
    return dict(sorted(result.items()))


def geocode(client: httpx.Client, city: str, sleep: Callable[[float], None] = time.sleep) -> Point:
    # A structured "city" search: a free-text one returns the province for some (Pisa, Brescia).
    params = {"city": city, "country": "Italia", "format": "json", "limit": "1"}
    try:
        resp = client.get(NOMINATIM_URL, params=params).raise_for_status()
    except httpx.HTTPError as exc:
        raise GeometryError(f"Geocoding {city}: {exc}") from exc
    finally:
        sleep(NOMINATIM_DELAY_SECONDS)
    found = resp.json()
    if not found:
        raise GeometryError(f"Geocoding {city}: not found")
    return round(float(found[0]["lon"]), DECIMALS), round(float(found[0]["lat"]), DECIMALS)


def sync_geometry(
    client: httpx.Client,
    reference_dir: Path,
    institutions: Iterable[Institution],
    sleep: Callable[[float], None] = time.sleep,
) -> Path:
    path = reference_dir / "geometry.json"
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    known: dict[str, list[float]] = previous.get("cities", {})
    try:
        geojson = client.get(REGIONS_URL).raise_for_status().json()
    except httpx.HTTPError as exc:
        raise GeometryError(f"{REGIONS_URL}: {exc}") from exc

    placed = [i for i in institutions if i.ustat and i.type == "university"]
    if missing := sorted(i.code for i in placed if i.code not in CITIES):
        raise GeometryError(f"No city for: {', '.join(missing)} (add them to CITIES)")
    cities: dict[str, list[float]] = {}
    for city in sorted({CITIES[i.code] for i in placed}):
        cities[city] = known.get(city) or list(geocode(client, city, sleep))
    data = {
        "sources": [
            {
                "measure": "regions",
                "source": "openpolis/geojson-italy (ISTAT)",
                "url": REGIONS_URL,
                "license": "CC-BY-4.0",
            },
            {
                "measure": "cities",
                "source": "OpenStreetMap contributors, via Nominatim",
                "url": NOMINATIM_URL,
                "license": "ODbL-1.0",
            },
        ],
        "regions": regions(geojson),
        "cities": cities,
        "universities": {i.code: CITIES[i.code] for i in sorted(placed, key=lambda i: i.code)},
    }
    path.write_text(json.dumps(data, ensure_ascii=False) + "\n", encoding="utf-8")
    log.info("Geometry: %d regions, %d cities", len(data["regions"]), len(cities))
    return path
