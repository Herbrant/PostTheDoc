// How the observatory's figures read in its tables and map titles: shared by the page, built
// once a day, and its script, which redraws them when the reader changes what to show.
import type {
  Class,
  Group,
  RateRow,
  ShareRow,
  Tone,
  WindowUniversity,
} from "../../lib/observatory";

/** The map's colours, most above the national average first, then those without a figure. */
export const TONE_ORDER: readonly Tone[] = [
  "much-higher",
  "higher",
  "in-line",
  "lower",
  "much-lower",
  "none",
];

/** The figures a table row needs (the page's data travels in this shape to the script). */
export interface RateView {
  code: string;
  observed: number;
  denominator: number;
  rate: number;
  low: number;
  high: number;
  ratio: number;
  class: Class;
  tone: Tone;
}

export interface ShareView {
  code: string;
  part: number;
  total: number;
  share: number;
  low: number;
  high: number;
  class: Class;
  tone: Tone;
}

const round = (n: number, digits = 3) => Number(n.toPrecision(digits));

export const rateView = (row: RateRow): RateView => ({
  code: row.code,
  observed: row.observed,
  denominator: row.denominator,
  rate: round(row.rate),
  low: round(row.low),
  high: round(row.high),
  ratio: round(row.ratio),
  class: row.class,
  tone: row.tone,
});

export const shareView = (row: ShareRow): ShareView => ({
  code: row.code,
  part: row.part,
  total: row.total,
  share: round(row.share),
  low: round(row.low),
  high: round(row.high),
  class: row.class,
  tone: row.tone,
});

const noFigure = (row: { tone: Tone }) => Number(row.tone === "none");

/** Highest first, as on the map; those without a figure last. */
export const byRate = (rows: readonly RateView[]) =>
  rows.toSorted((a, b) => noFigure(a) - noFigure(b) || b.ratio - a.ratio);
export const byShare = (rows: readonly ShareView[]) =>
  rows.toSorted((a, b) => noFigure(a) - noFigure(b) || b.share - a.share);

export interface Formats {
  integer: (n: number) => string;
  decimal: (n: number) => string;
  percent: (n: number) => string;
}

export function formats(lang: string): Formats {
  const integer = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
  const small = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
  const large = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 });
  return {
    integer: (n) => integer.format(n),
    decimal: (n) => (Math.abs(n) < 10 ? small : large).format(n),
    percent: (n) => percent.format(n),
  };
}

/** The cells of a rate row: name, positions, denominator, rate, interval, ratio, result. */
export function rateCells(row: RateView, name: string, classLabel: string, f: Formats): string[] {
  return [
    name,
    f.integer(row.observed),
    f.integer(row.denominator),
    f.decimal(row.rate),
    `${f.decimal(row.low)} – ${f.decimal(row.high)}`,
    f.decimal(row.ratio),
    classLabel,
  ];
}

/** The cells of a share row: name, precarious, total, share, interval, result. */
export function shareCells(row: ShareView, name: string, classLabel: string, f: Formats): string[] {
  return [
    name,
    f.integer(row.part),
    f.integer(row.total),
    f.percent(row.share),
    `${f.percent(row.low)} – ${f.percent(row.high)}`,
    classLabel,
  ];
}

/** The cells of the application windows per university: name, calls, median, share under 15. */
export function windowCells(rows: readonly WindowUniversity[], f: Formats): string[][] {
  return rows
    .toSorted((a, b) => b.short - a.short || a.median - b.median)
    .map((u) => [u.name, f.integer(u.calls), f.decimal(u.median), f.percent(u.short)]);
}

/** The cells of an institution without a denominator: name, then positions per group. */
export function otherCells(row: { name: string; counts: Record<Group, number> }, f: Formats) {
  return [
    row.name,
    f.integer(row.counts.permanent),
    f.integer(row.counts.precarious),
    f.integer(row.counts.phd),
  ];
}
