// How the observatory's figures read in its tables and map titles: shared by the page, built
// once a day, and its script, which redraws them when the reader changes what to show.
import type { Class, RateRow, ShareRow } from "../../lib/observatory";

/** Most above the national average first, then in line, below, and those not assessed. */
export const CLASS_ORDER: readonly Class[] = [
  "much-higher",
  "higher",
  "in-line",
  "lower",
  "much-lower",
  "insufficient",
];
const rank = (c: Class) => CLASS_ORDER.indexOf(c);

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
}

export interface ShareView {
  code: string;
  part: number;
  total: number;
  share: number;
  low: number;
  high: number;
  class: Class;
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
});

export const shareView = (row: ShareRow): ShareView => ({
  code: row.code,
  part: row.part,
  total: row.total,
  share: round(row.share),
  low: round(row.low),
  high: round(row.high),
  class: row.class,
});

export const byRate = (rows: readonly RateView[]) =>
  rows.toSorted((a, b) => rank(a.class) - rank(b.class) || b.ratio - a.ratio);
export const byShare = (rows: readonly ShareView[]) =>
  rows.toSorted((a, b) => rank(a.class) - rank(b.class) || b.share - a.share);

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
