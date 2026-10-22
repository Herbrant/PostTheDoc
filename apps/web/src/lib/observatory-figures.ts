// The observatory's figures for a period: computed at build time for the default period, and in
// the browser when the reader picks another one. No Node or build-only imports here.
import type { ArchivedCall } from "@postthedoc/shared/archive";
import {
  count,
  counted,
  GROUPS,
  type Group,
  level,
  type Measure,
  PER,
  type Period,
  period,
  precarity,
  type Range,
  type Rates,
  rates,
  type Shares,
  shares,
  type Trend,
  trend,
  type University,
} from "./observatory";

export const MEASURES: readonly Measure[] = ["staff", "students", "residents"];
export const GROUP_KEYS = Object.keys(GROUPS) as Group[];

export interface Variant {
  regions: Rates;
  universities: Rates;
}

/** What the figures are computed against: the universities and the regions' residents. */
export interface Units {
  universities: University[];
  residents: Record<string, { residents: number }>;
  regionNames: Record<string, string>;
}

export interface Figures {
  period: Period;
  calls: number;
  universities: number;
  /** `${group}/${measure}` -> rates. */
  territory: Record<string, Variant>;
  precarity: { regions: Shares; universities: Shares };
  trend: Trend;
  /** Positions of the institutions without denominators, by name, most first. */
  others: { name: string; counts: Record<Group, number> }[];
}

export function figures(
  calls: readonly ArchivedCall[],
  units: Units,
  now: Date,
  range: Range = {},
): Figures {
  const byCode = new Map(units.universities.map((u) => [u.code, u]));
  const regionNames = new Map(Object.entries(units.regionNames));
  const denominators = { universities: {}, regions: units.residents };
  const p = period(calls, now, range);
  const inPeriod = counted(calls, p);
  const counts = count(inPeriod, byCode);

  const territory: Record<string, Variant> = {};
  for (const group of GROUP_KEYS) {
    for (const measure of MEASURES) {
      const rows = level(counts, units.universities, denominators, group, measure, regionNames);
      territory[`${group}/${measure}`] = {
        regions: rates(rows.regions, PER[measure]),
        universities: rates(rows.universities, PER[measure]),
      };
    }
  }
  const precarious = precarity(counts, units.universities, regionNames);
  const total = (c: Record<Group, number>) => c.faculty + c.precarious + c.phd;
  return {
    period: p,
    calls: counts.calls,
    universities: units.universities.length,
    territory,
    precarity: {
      regions: shares(precarious.regions),
      universities: shares(precarious.universities),
    },
    trend: trend(inPeriod, p),
    others: [...counts.others]
      .map(([name, c]) => ({ name, counts: c }))
      .sort((a, b) => total(b.counts) - total(a.counts) || a.name.localeCompare(b.name)),
  };
}
