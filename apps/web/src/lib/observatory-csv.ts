// The observatory's figures as CSV files: written at build time for the default period, and in
// the browser for the period the reader picks. Codes from data/reference/, Italian names.
import { WINDOW_BUCKETS } from "./observatory";
import { type Figures, GROUP_KEYS, MEASURES } from "./observatory-figures";

export const CSV_FILES = ["territory", "precarity", "window", "trend"] as const;
export type CsvFile = (typeof CSV_FILES)[number];

const cell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csv = (header: string[], rows: unknown[][]) =>
  `${[header, ...rows].map((row) => row.map(cell).join(",")).join("\n")}\n`;

const LEVELS = ["regions", "universities"] as const;

/** The CSV text of `file`, empty (only its header) without figures. */
export function csvTable(file: CsvFile, data: Figures | null): string {
  switch (file) {
    case "territory":
      return csv(
        [
          "group",
          "measure",
          "level",
          "code",
          "name",
          "positions",
          "denominator",
          "rate",
          "low_95",
          "high_95",
          "expected",
          "ratio",
          "map_tone",
          "national_rate",
          "phi",
        ],
        data
          ? GROUP_KEYS.flatMap((group) =>
              MEASURES.flatMap((measure) =>
                LEVELS.flatMap((level) => {
                  const rates = data.territory[`${group}/${measure}`]?.[level];
                  return (rates?.rows ?? []).map((r) => [
                    group,
                    measure,
                    level,
                    r.code,
                    r.name,
                    r.observed,
                    r.denominator,
                    r.rate,
                    r.low,
                    r.high,
                    r.expected,
                    r.ratio,
                    r.tone,
                    rates?.national,
                    rates?.phi,
                  ]);
                }),
              ),
            )
          : [],
      );
    case "precarity":
      return csv(
        [
          "level",
          "code",
          "name",
          "precarious",
          "total",
          "share",
          "low_95",
          "high_95",
          "map_tone",
          "national_share",
          "phi",
        ],
        data
          ? LEVELS.flatMap((level) =>
              data.precarity[level].rows.map((r) => [
                level,
                r.code,
                r.name,
                r.part,
                r.total,
                r.share,
                r.low,
                r.high,
                r.tone,
                data.precarity[level].national,
                data.precarity[level].phi,
              ]),
            )
          : [],
      );
    case "window":
      return csv(
        [
          "group",
          ...WINDOW_BUCKETS.map(([lo, hi]) =>
            Number.isFinite(hi) ? `days_${lo}_${hi}` : `days_${lo}_plus`,
          ),
          "median_days",
          "calls",
        ],
        data ? data.windows.groups.map((g) => [g.group, ...g.buckets, g.median, g.calls]) : [],
      );
    case "trend":
      return csv(
        ["period", "group", "calls", "positions", "partial"],
        data
          ? data.trend.buckets.flatMap((b) =>
              GROUP_KEYS.map((g) => [b.key, g, b.calls[g], b.positions[g], b.partial]),
            )
          : [],
      );
  }
}

/** e.g. "territory_2026-09-25_2026-12-31.csv". */
export const csvName = (file: CsvFile, data: Figures) =>
  `${file}_${data.period.start.toISOString().slice(0, 10)}_${data.period.end.toISOString().slice(0, 10)}.csv`;
