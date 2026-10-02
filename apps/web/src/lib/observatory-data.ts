// The observatory page's data, computed at build time from the archive of every call seen, the
// denominators and the map in data/reference/. The statistics are in ./observatory.ts.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ArchivedCall, archivedCalls } from "@postthedoc/shared/archive";
import { denominators, type Geometry, geometry } from "@postthedoc/shared/observatory";
import type { Locale } from "../i18n";
import {
  type Counted,
  count,
  counted,
  GROUPS,
  type Group,
  level,
  type Measure,
  type Month,
  monthly,
  PER,
  type Period,
  period,
  precarity,
  type Rates,
  rates,
  type Shares,
  shares,
  type University,
  windows,
} from "./observatory";
import { institutions, regions } from "./reference";

/**
 * data/archive/calls.jsonl, or the file in ARCHIVE_FILE (e.g. a copy, to preview the page).
 * Builds run from apps/web/. Missing before the daily job first writes it: the page says so.
 */
export const archiveFile = () =>
  resolve(import.meta.env.ARCHIVE_FILE || resolve(process.cwd(), "../../data/archive/calls.jsonl"));

export const MEASURES: readonly Measure[] = ["staff", "students", "residents"];
export const GROUP_KEYS = Object.keys(GROUPS) as Group[];

export interface Variant {
  regions: Rates;
  universities: Rates;
}

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
  period: Period;
  calls: number;
  universities: number;
  /** `${group}/${measure}` -> rates. */
  territory: Record<string, Variant>;
  precarity: { regions: Shares; universities: Shares };
  windows: ReturnType<typeof windows>;
  months: Month[];
  /** Positions of the institutions without denominators, by name, most first. */
  others: { name: string; counts: Record<Group, number> }[];
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
  const units = universities();
  const byCode = new Map(units.map((u) => [u.code, u]));
  const regionNames = new Map(regions.map((r) => [r.code, r.name[lang]]));
  const p = period(calls, now);
  const inPeriod = counted(calls, p);
  const counts: Counted = count(inPeriod, byCode);

  const territory: Record<string, Variant> = {};
  for (const group of GROUP_KEYS) {
    for (const measure of MEASURES) {
      const rows = level(counts, units, denominators, group, measure, regionNames);
      territory[`${group}/${measure}`] = {
        regions: rates(rows.regions, PER[measure]),
        universities: rates(rows.universities, PER[measure]),
      };
    }
  }
  const precarious = precarity(counts, units, regionNames);
  const total = (c: Record<Group, number>) => c.permanent + c.precarious + c.phd;
  return {
    period: p,
    calls: counts.calls,
    universities: units.length,
    territory,
    precarity: {
      regions: shares(precarious.regions),
      universities: shares(precarious.universities),
    },
    windows: windows(inPeriod, byCode),
    months: monthly(inPeriod),
    others: [...counts.others]
      .map(([name, c]) => ({ name, counts: c }))
      .sort((a, b) => total(b.counts) - total(a.counts) || a.name.localeCompare(b.name)),
    map: project(geometry, units),
    names: Object.fromEntries([
      ...units.map((u) => [u.code, u.name]),
      ...[...regionNames].map(([code, name]) => [code, name]),
    ]),
  };
}

/** The observatory's data at build time, or null before the archive exists. */
export function loadObservatory(lang: Locale, now = new Date()): ObservatoryData | null {
  const file = archiveFile();
  if (!existsSync(file)) return null;
  return observatory(archivedCalls(readFileSync(file, "utf-8")), lang, now);
}
