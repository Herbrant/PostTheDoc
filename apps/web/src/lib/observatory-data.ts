// The observatory page's data at build time: the archive of every call seen, the denominators and
// the map in data/reference/. The figures are in ./observatory-figures.ts (also run in the
// browser), the statistics in ./observatory.ts.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ArchivedCall, archivedCalls } from "@postthedoc/shared/archive";
import { denominators, type Geometry, geometry } from "@postthedoc/shared/observatory";
import type { Locale } from "../i18n";
import { dayOf, type University } from "./observatory";
import { type Figures, figures, type Units } from "./observatory-figures";
import { institutions, regions } from "./reference";

/**
 * data/archive/calls.jsonl, or the file in ARCHIVE_FILE (e.g. a copy, to preview the page).
 * Builds run from apps/web/. Missing before the daily job first writes it: the page says so.
 */
export const archiveFile = () =>
  resolve(import.meta.env.ARCHIVE_FILE || resolve(process.cwd(), "../../data/archive/calls.jsonl"));

export interface Point {
  code: string;
  x: number;
  y: number;
  r: number;
}

export interface MapShape {
  width: number;
  height: number;
  regions: { code: string; d: string }[];
  universities: Point[];
}

export interface ObservatoryData {
  /** The figures of the default period: from the start of the collection to now. */
  figures: Figures;
  calls: ArchivedCall[];
  units: Units;
  map: MapShape;
  names: Record<string, string>;
}

const MAP_WIDTH = 560;
const MIN_RADIUS = 3;
const MAX_RADIUS = 15;

function universities(): University[] {
  return institutions.flatMap((i) => {
    const size = denominators.universities[i.code];
    return size && (i.type === "university" || i.type === "online_university")
      ? [
          {
            code: i.code,
            name: i.name,
            region: i.region,
            online: i.type === "online_university",
            staff: size.staff,
            students: size.students,
          },
        ]
      : [];
  });
}

/** Italy in an equirectangular projection scaled at 42°N: the map is small, Italy is narrow. */
function project(map: Geometry, units: readonly University[]): MapShape {
  const rings = Object.values(map.regions).flat();
  const lons = rings.flat().map(([lon]) => lon);
  const lats = rings.flat().map(([, lat]) => lat);
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const cos = Math.cos((42 * Math.PI) / 180);
  const k = MAP_WIDTH / ((maxLon - minLon) * cos);
  const xy = ([lon, lat]: [number, number]): [number, number] => [
    (lon - minLon) * cos * k,
    (maxLat - lat) * k,
  ];
  const fixed = (n: number) => Math.round(n * 10) / 10;
  const regionShapes = Object.entries(map.regions).map(([code, polygons]) => ({
    code,
    d: polygons
      .map((ring) => `M${ring.map((p) => xy(p).map(fixed).join(",")).join("L")}Z`)
      .join(""),
  }));

  // Circles with an area proportional to the staff, packed around their city.
  const largest = Math.max(...units.map((u) => u.staff));
  const radius = (staff: number) => Math.max(MIN_RADIUS, MAX_RADIUS * Math.sqrt(staff / largest));
  const cities = map.universities;
  const coordinates = map.cities;
  const byCity = new Map<string, University[]>();
  for (const u of units) {
    const city = cities[u.code];
    if (city && !u.online) byCity.set(city, [...(byCity.get(city) ?? []), u]);
  }
  const points: Point[] = [];
  for (const [city, members] of byCity) {
    const centre = coordinates[city];
    if (!centre) continue;
    const [cx, cy] = xy(centre);
    const placed: Point[] = [];
    for (const u of members.toSorted((a, b) => b.staff - a.staff || a.code.localeCompare(b.code))) {
      const r = radius(u.staff);
      let spot = { x: cx, y: cy };
      // The first sits on the city; the others on growing rings around it, where they fit.
      for (let distance = 0, found = placed.length === 0; !found; distance += 1.5) {
        for (let angle = 0; angle < 360 && !found; angle += 20) {
          const x = cx + distance * Math.cos((angle * Math.PI) / 180);
          const y = cy + distance * Math.sin((angle * Math.PI) / 180);
          if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + 1)) {
            spot = { x, y };
            found = true;
          }
        }
      }
      const point = { code: u.code, x: fixed(spot.x), y: fixed(spot.y), r: fixed(r) };
      placed.push(point);
      points.push(point);
    }
  }
  return {
    width: MAP_WIDTH,
    height: Math.ceil((maxLat - minLat) * k),
    regions: regionShapes,
    universities: points,
  };
}

export function observatory(
  calls: readonly ArchivedCall[],
  lang: Locale,
  now = new Date(),
): ObservatoryData {
  const list = universities();
  const regionNames = Object.fromEntries(regions.map((r) => [r.code, r.name[lang]]));
  const units: Units = { universities: list, residents: denominators.regions, regionNames };
  return {
    // To the end of the day, as the page's script computes it: the same figures on both sides.
    figures: figures(calls, units, new Date(`${dayOf(now)}T23:59:59.999Z`)),
    calls: [...calls],
    units,
    map: project(geometry, list),
    names: { ...Object.fromEntries(list.map((u) => [u.code, u.name])), ...regionNames },
  };
}

/** The observatory's data at build time, or null before the archive exists. */
export function loadObservatory(lang: Locale, now = new Date()): ObservatoryData | null {
  const file = archiveFile();
  if (!existsSync(file)) return null;
  return observatory(archivedCalls(readFileSync(file, "utf-8")), lang, now);
}
