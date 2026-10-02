// The observatory's figures as CSV files, for checking them or reusing them: the same numbers
// as the page (Italian names, codes from data/reference/), one row per figure.
import type { APIRoute } from "astro";
import { WINDOW_BUCKETS } from "../../lib/observatory";
import {
  GROUP_KEYS,
  loadObservatory,
  MEASURES,
  type ObservatoryData,
} from "../../lib/observatory-data";

const FILES = ["territory", "precarity", "window", "months"] as const;
type File = (typeof FILES)[number];

export const getStaticPaths = () => FILES.map((file) => ({ params: { file } }));

const cell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = (header: string[], rows: unknown[][]) =>
  `${[header, ...rows].map((row) => row.map(cell).join(",")).join("\n")}\n`;

function table(file: File, data: ObservatoryData | null): string {
  const levels = ["regions", "universities"] as const;
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
          "z",
          "class",
          "national_rate",
          "phi",
        ],
        data
          ? GROUP_KEYS.flatMap((group) =>
              MEASURES.flatMap((measure) => {
                const variant = data.territory[`${group}/${measure}`];
                return levels.flatMap((level) => {
                  const rates = variant?.[level];
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
                    r.z,
                    r.class,
                    rates?.national,
                    rates?.phi,
                  ]);
                });
              }),
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
          "z",
          "class",
          "national_share",
          "phi",
        ],
        data
          ? levels.flatMap((level) =>
              data.precarity[level].rows.map((r) => [
                level,
                r.code,
                r.name,
                r.part,
                r.total,
                r.share,
                r.low,
                r.high,
                r.z,
                r.class,
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
    case "months":
      return csv(
        ["month", "group", "calls", "positions"],
        data
          ? data.months.flatMap((m) =>
              GROUP_KEYS.map((g) => [m.month, g, m.calls[g], m.positions[g]]),
            )
          : [],
      );
  }
}

export const GET: APIRoute = ({ params }) =>
  new Response(table(params.file as File, loadObservatory("it")), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
