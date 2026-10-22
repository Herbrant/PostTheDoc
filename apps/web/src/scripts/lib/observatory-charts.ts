// The observatory's charts as shapes: drawn as SVG at build time (components/observatory/Svg.astro)
// and redrawn by the page's script (renderSvg) when the reader picks another period, so that the
// two cannot drift apart.
import type { Group, Trend } from "../../lib/observatory";

export interface SvgNode {
  tag: "g" | "rect" | "text" | "line" | "title";
  attrs?: Record<string, string | number>;
  text?: string;
  children?: SvgNode[];
}

export interface ChartSpec {
  viewBox: string;
  label: string;
  nodes: SvgNode[];
}

// --- Trend: positions per month or year, one small chart per group ---------------------------

export interface TrendLabels {
  partialMonth: string;
  partialYear: string;
}

const T_WIDTH = 300;
const T_HEIGHT = 140;
const T_TOP = 18;
const T_BOTTOM = 22;
/** At most this many tick labels per chart. */
const MAX_TICKS = 8;

/** "set 26" for a month, "2026" for a year. */
export function bucketLabel(key: string, lang: string): string {
  if (key.length === 4) return key;
  const month = new Intl.DateTimeFormat(lang, { month: "short", year: "2-digit", timeZone: "UTC" });
  return month.format(new Date(`${key}-01T00:00:00Z`));
}

export function trendSpec(
  trend: Trend,
  group: Group,
  label: string,
  t: TrendLabels,
  lang: string,
): ChartSpec {
  const integer = new Intl.NumberFormat(lang);
  const plot = T_HEIGHT - T_TOP - T_BOTTOM;
  const buckets = trend.buckets;
  const step = buckets.length ? T_WIDTH / buckets.length : T_WIDTH;
  const bar = Math.min(28, step * 0.6);
  const values = buckets.map((b) => b.positions[group]);
  const max = Math.max(1, ...values);
  const top = values.indexOf(Math.max(...values));
  const every = Math.ceil(buckets.length / MAX_TICKS);
  const partial = trend.granularity === "year" ? t.partialYear : t.partialMonth;
  const nodes: SvgNode[] = [
    {
      tag: "line",
      attrs: { x1: 0, x2: T_WIDTH, y1: T_TOP + plot, y2: T_TOP + plot, class: "obs-axis" },
    },
  ];
  buckets.forEach((b, i) => {
    const value = b.positions[group];
    const h = (value / max) * plot;
    const x = i * step + (step - bar) / 2;
    const name = bucketLabel(b.key, lang);
    nodes.push({
      tag: "rect",
      attrs: {
        x,
        y: T_TOP + plot - h,
        width: bar,
        height: Math.max(h, 0),
        rx: 4,
        class: b.partial ? "obs-bar obs-bar-partial" : "obs-bar",
      },
      children: [
        {
          tag: "title",
          text: `${name}: ${integer.format(value)}${b.partial ? ` (${partial})` : ""}`,
        },
      ],
    });
    if (i === top && value > 0) {
      nodes.push({
        tag: "text",
        attrs: { x: x + bar / 2, y: T_TOP + plot - h - 5, class: "obs-value" },
        text: integer.format(value),
      });
    }
    if (i % every === 0) {
      nodes.push({
        tag: "text",
        attrs: { x: x + bar / 2, y: T_HEIGHT - 6, class: "obs-tick" },
        text: name,
      });
    }
  });
  return { viewBox: `0 0 ${T_WIDTH} ${T_HEIGHT}`, label, nodes };
}

// --- In the browser ----------------------------------------------------------------------

const SVG = "http://www.w3.org/2000/svg";

function node(spec: SvgNode): SVGElement {
  const element = document.createElementNS(SVG, spec.tag);
  for (const [name, value] of Object.entries(spec.attrs ?? {})) {
    element.setAttribute(name, String(value));
  }
  if (spec.text !== undefined) element.textContent = spec.text;
  for (const child of spec.children ?? []) element.append(node(child));
  return element;
}

/** Redraw `svg` from a chart spec. */
export function renderSvg(svg: SVGSVGElement, spec: ChartSpec): void {
  svg.setAttribute("viewBox", spec.viewBox);
  svg.setAttribute("aria-label", spec.label);
  svg.replaceChildren(...spec.nodes.map(node));
}
