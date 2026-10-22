/**
 * The observatory's figures, computed at build time from the archive of every call seen and the
 * denominators in data/reference/denominators.json. The method is described on the page
 * (content/observatory/): change both together.
 */
import type { ArchivedCall } from "@postthedoc/shared/archive";

/**
 * Researchers are fixed-term too, but most are on the tenure track (RTT), and the portal does not
 * tell them apart from the others: they count with the professors, not as precarious.
 * Technologists are hired on fixed-term project funds: they are precarious.
 */
export type Group = "faculty" | "precarious" | "phd";
export const GROUPS: Record<Group, readonly string[]> = {
  faculty: ["researcher", "associate_professor", "full_professor"],
  precarious: [
    "research_fellowship",
    "postdoc_fellowship",
    "research_contract",
    "research_grant",
    "technologist",
  ],
  phd: ["phd"],
};
const GROUP_OF = new Map(
  Object.entries(GROUPS).flatMap(([group, roles]) => roles.map((role) => [role, group as Group])),
);

export type Measure = "staff" | "students" | "residents";
/** Rates per 100 staff, per 1,000 students, per 100,000 residents. */
export const PER: Record<Measure, number> = { staff: 100, students: 1000, residents: 100000 };

/** Two-sided 95% normal quantile, for the intervals. */
export const Z_95 = 1.96;
const DAY = 86_400_000;

/** How far a unit is from the national average, whether or not chance can explain it. */
export type Tone = "much-lower" | "lower" | "in-line" | "higher" | "much-higher" | "none";

/** Rates: half or less, 20% below, within, 25% above, double or more (symmetric in ratio). */
export const RATIO_STEPS = { muchLower: 0.5, lower: 0.8, higher: 1.25, muchHigher: 2 } as const;
/** Shares: percentage points from the national share. */
export const SHARE_STEPS = { moderate: 0.05, strong: 0.15 } as const;

export function ratioTone(ratio: number | null): Tone {
  if (ratio === null) return "none";
  if (ratio <= RATIO_STEPS.muchLower) return "much-lower";
  if (ratio <= RATIO_STEPS.lower) return "lower";
  if (ratio >= RATIO_STEPS.muchHigher) return "much-higher";
  if (ratio >= RATIO_STEPS.higher) return "higher";
  return "in-line";
}

export function shareTone(difference: number | null): Tone {
  if (difference === null) return "none";
  if (difference <= -SHARE_STEPS.strong) return "much-lower";
  if (difference <= -SHARE_STEPS.moderate) return "lower";
  if (difference >= SHARE_STEPS.strong) return "much-higher";
  if (difference >= SHARE_STEPS.moderate) return "higher";
  return "in-line";
}

export interface University {
  code: string;
  name: string;
  region: string | null;
  online: boolean;
  staff: number;
  students: number | null;
}

export interface Denominators {
  universities: Record<string, { staff: number; students: number | null }>;
  regions: Record<string, { residents: number }>;
}

// --- Period ---------------------------------------------------------------------------------

export interface Period {
  start: Date;
  end: Date;
  /** The first day of the collection: no period starts earlier. */
  began: Date;
  /** Days covered. */
  days: number;
  /** Shorter than a year: seasonal calls (PhDs in summer) weigh more than they should. */
  short: boolean;
}

/** Days as YYYY-MM-DD, in UTC like the dates of the calls. */
export interface Range {
  from?: string | undefined;
  to?: string | undefined;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The start of a YYYY-MM-DD day (UTC), or null if it is not a valid day. */
export function parseDay(day: string): Date | null {
  if (!DAY_RE.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : date;
}

export const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

/** When a call was issued: its date, or when it was first found. */
export const issued = (call: ArchivedCall): Date =>
  call.published ? new Date(`${call.published}T00:00:00Z`) : call.firstSeen;

/** The first day of the collection: the day the earliest call was found. */
export function began(calls: readonly ArchivedCall[], now: Date): Date {
  const first = calls.reduce((min, c) => Math.min(min, c.firstSeen.getTime()), now.getTime());
  return parseDay(dayOf(new Date(first))) ?? now;
}

/**
 * The days of `range`, from the start of the collection to `now` by default. A period never
 * starts before the collection began: of the calls issued earlier only those still open were
 * seen, and counting them would favour the calls open longest. A range that makes no sense
 * (a day out of bounds, a start after the end) falls back to the default.
 */
export function period(calls: readonly ArchivedCall[], now: Date, range: Range = {}): Period {
  const first = began(calls, now);
  let start = range.from ? parseDay(range.from) : first;
  const toDay = range.to ? parseDay(range.to) : null;
  let end = range.to ? (toDay ? new Date(toDay.getTime() + DAY - 1) : null) : now;
  if (!start || start < first) start = first;
  if (!end || end > now) end = now;
  if (start > end) [start, end] = [first, now];
  const days = Math.round((end.getTime() - start.getTime()) / DAY);
  return { start, end, began: first, days, short: days < 365 };
}

// --- Counting -------------------------------------------------------------------------------

export type Counts = Record<Group, number>;
const zero = (): Counts => ({ faculty: 0, precarious: 0, phd: 0 });

export interface Counted {
  /** Positions per university with denominators. */
  universities: Map<string, Counts>;
  /** Positions of the other institutions (research institutes, AFAM, ...), by name. */
  others: Map<string, Counts>;
  calls: number;
  /** Calls counted as one position because the portal does not say how many. */
  imputed: number;
}

/** The calls of the period that count: not withdrawn, of a known role. */
export function counted(calls: readonly ArchivedCall[], p: Period): ArchivedCall[] {
  return calls.filter((call) => {
    const when = issued(call).getTime();
    return (
      !call.withdrawn &&
      GROUP_OF.has(call.role) &&
      !undated(call, p) &&
      when >= p.start.getTime() &&
      when <= p.end.getTime()
    );
  });
}

/**
 * A call without a date found on the first day of the collection: it may have been issued long
 * before, so it cannot be placed in any period. Found on a later day, it was issued about then.
 */
export const undated = (call: ArchivedCall, p: Period): boolean =>
  !call.published && call.firstSeen.getTime() < p.began.getTime() + DAY;

export function count(
  calls: readonly ArchivedCall[],
  universities: ReadonlyMap<string, University>,
): Counted {
  const result: Counted = { universities: new Map(), others: new Map(), calls: 0, imputed: 0 };
  for (const call of calls) {
    const group = GROUP_OF.get(call.role);
    if (!group) continue;
    const known = call.institutionCode !== null && universities.has(call.institutionCode);
    const key = known ? (call.institutionCode as string) : call.institution;
    const map = known ? result.universities : result.others;
    const counts = map.get(key) ?? zero();
    counts[group] += call.positions ?? 1;
    map.set(key, counts);
    result.calls += 1;
    if (call.positions === null) result.imputed += 1;
  }
  return result;
}

// --- Statistics -----------------------------------------------------------------------------

/** Byar's approximation of the exact Poisson interval for an observed count. */
export function byar(observed: number, z = Z_95): [number, number] {
  const o = observed;
  const low = o === 0 ? 0 : o * (1 - 1 / (9 * o) - z / (3 * Math.sqrt(o))) ** 3;
  const up = o + 1;
  const high = up * (1 - 1 / (9 * up) + z / (3 * Math.sqrt(up))) ** 3;
  return [Math.max(0, low), high];
}

export interface RateInput {
  code: string;
  name: string;
  observed: number;
  denominator: number;
}

export interface RateRow extends RateInput {
  rate: number;
  low: number;
  high: number;
  expected: number;
  ratio: number;
  tone: Tone;
}

export interface Rates {
  rows: RateRow[];
  /** The national rate, per `per`. */
  national: number;
}

/** Rates per `per`, compared with the national rate of the same units. */
export function rates(items: readonly RateInput[], per: number): Rates {
  const units = items.filter((item) => item.denominator > 0);
  const observed = units.reduce((sum, u) => sum + u.observed, 0);
  const denominator = units.reduce((sum, u) => sum + u.denominator, 0);
  const p = denominator > 0 ? observed / denominator : 0;
  const rows = units.map((u) => {
    const expected = p * u.denominator;
    const [low, high] = byar(u.observed);
    return {
      ...u,
      rate: (u.observed / u.denominator) * per,
      low: (low / u.denominator) * per,
      high: (high / u.denominator) * per,
      expected,
      ratio: expected > 0 ? u.observed / expected : 0,
      // Without any position nationwide there is no average to compare with.
      tone: ratioTone(expected > 0 ? u.observed / expected : null),
    };
  });
  return { rows, national: p * per };
}

export interface ShareInput {
  code: string;
  name: string;
  part: number;
  total: number;
}

export interface ShareRow extends ShareInput {
  share: number;
  low: number;
  high: number;
  tone: Tone;
}

export interface Shares {
  rows: ShareRow[];
  national: number;
}

/** Wilson's 95% interval for a proportion. */
export function wilson(part: number, total: number, z = Z_95): [number, number] {
  if (total === 0) return [0, 0];
  const p = part / total;
  const z2 = z * z;
  const centre = (p + z2 / (2 * total)) / (1 + z2 / total);
  const half = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / (1 + z2 / total);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Shares `part / total`, compared with the national share of the same units. */
export function shares(items: readonly ShareInput[]): Shares {
  const units = items.filter((item) => item.total > 0);
  const part = units.reduce((sum, u) => sum + u.part, 0);
  const total = units.reduce((sum, u) => sum + u.total, 0);
  const p = total > 0 ? part / total : 0;
  const rows = units.map((u) => {
    const share = u.part / u.total;
    const [low, high] = wilson(u.part, u.total);
    return {
      ...u,
      share,
      low,
      high,
      tone: shareTone(share - p),
    };
  });
  return { rows, national: p };
}

// --- Universities and regions ---------------------------------------------------------------

export interface Level {
  universities: RateInput[];
  regions: RateInput[];
}

/**
 * Observed positions of `group` and the denominator `measure`, per university and per region.
 * A region is the sum of its universities, online ones excepted (their students come from
 * everywhere): the numerator and the denominator always cover the same universities.
 */
export function level(
  counts: Counted,
  universities: readonly University[],
  denominators: Denominators,
  group: Group,
  measure: Measure,
  regionNames: ReadonlyMap<string, string>,
): Level {
  const size = (u: University) => (measure === "students" ? u.students : u.staff);
  const observed = (u: University) => counts.universities.get(u.code)?.[group] ?? 0;
  const byUniversity =
    measure === "residents"
      ? []
      : universities.flatMap((u) => {
          const denominator = size(u);
          return denominator === null
            ? []
            : [{ code: u.code, name: u.name, observed: observed(u), denominator }];
        });
  const byRegion = new Map<string, RateInput>();
  for (const u of universities) {
    if (u.online || u.region === null) continue;
    const denominator = measure === "residents" ? 0 : size(u);
    if (denominator === null) continue;
    const row = byRegion.get(u.region) ?? {
      code: u.region,
      name: regionNames.get(u.region) ?? u.region,
      observed: 0,
      denominator: measure === "residents" ? (denominators.regions[u.region]?.residents ?? 0) : 0,
    };
    row.observed += observed(u);
    row.denominator += denominator;
    byRegion.set(u.region, row);
  }
  return { universities: byUniversity, regions: [...byRegion.values()] };
}

/** Precarious positions over precarious and faculty ones, per university and region. */
export function precarity(
  counts: Counted,
  universities: readonly University[],
  regionNames: ReadonlyMap<string, string>,
): { universities: ShareInput[]; regions: ShareInput[] } {
  const share = (code: string, name: string, c: Counts): ShareInput => ({
    code,
    name,
    part: c.precarious,
    total: c.precarious + c.faculty,
  });
  const byRegion = new Map<string, Counts>();
  const byUniversity = universities.map((u) => {
    const c = counts.universities.get(u.code) ?? zero();
    if (!u.online && u.region !== null) {
      const r = byRegion.get(u.region) ?? zero();
      r.precarious += c.precarious;
      r.faculty += c.faculty;
      byRegion.set(u.region, r);
    }
    return share(u.code, u.name, c);
  });
  return {
    universities: byUniversity,
    regions: [...byRegion].map(([code, c]) => share(code, regionNames.get(code) ?? code, c)),
  };
}

// --- Trend ----------------------------------------------------------------------------------

export type Granularity = "month" | "year";

export interface Bucket {
  /** "2026-09" for a month, "2026" for a year. */
  key: string;
  calls: Counts;
  positions: Counts;
  /**
   * Whether part of the month or year falls outside the period (e.g. the current month). The
   * month or year the collection began in is not: there is nothing before it to miss.
   */
  partial: boolean;
}

export interface Trend {
  granularity: Granularity;
  buckets: Bucket[];
}

/** Periods longer than this are shown by year. */
export const MONTHLY_DAYS = 366;

/**
 * Calls and positions of the period per month (or year, past MONTHLY_DAYS) of issue and group,
 * oldest first: every month or year of the period, empty ones too.
 */
export function trend(calls: readonly ArchivedCall[], p: Period): Trend {
  const granularity: Granularity = p.days > MONTHLY_DAYS ? "year" : "month";
  const yearly = granularity === "year";
  const buckets = new Map<string, Bucket>();
  const first = p.start;
  let y = first.getUTCFullYear();
  let m = yearly ? 0 : first.getUTCMonth();
  while (Date.UTC(y, m, 1) <= p.end.getTime()) {
    const from = Date.UTC(y, m, 1);
    const to = yearly ? Date.UTC(y + 1, 0, 1) - 1 : Date.UTC(y, m + 1, 1) - 1;
    const key = yearly ? String(y) : `${y}-${String(m + 1).padStart(2, "0")}`;
    const cutAtStart = from < p.start.getTime() && p.start.getTime() > p.began.getTime();
    const partial = cutAtStart || to > p.end.getTime();
    buckets.set(key, { key, calls: zero(), positions: zero(), partial });
    if (yearly) y += 1;
    else [y, m] = m === 11 ? [y + 1, 0] : [y, m + 1];
  }
  for (const call of calls) {
    const group = GROUP_OF.get(call.role);
    const bucket = buckets.get(dayOf(issued(call)).slice(0, yearly ? 4 : 7));
    if (!group || !bucket) continue;
    bucket.calls[group] += 1;
    bucket.positions[group] += call.positions ?? 1;
  }
  return { granularity, buckets: [...buckets.values()] };
}
