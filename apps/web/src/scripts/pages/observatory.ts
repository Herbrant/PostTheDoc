// Observatory page: computes the figures of the period the reader picks, with the same functions
// the build uses (lib/observatory-figures.ts) on the calls in /observatory/calls.json, and redraws
// maps, tables, charts and CSV links; switches the positions, denominator and level shown.
import { format } from "../../i18n/format";
import type { Class, Group, Range, Tone } from "../../lib/observatory";
import { type CompactCalls, expand } from "../../lib/observatory-calls";
import { CSV_FILES, csvName, csvTable } from "../../lib/observatory-csv";
import { type Figures, figures, GROUP_KEYS, type Units } from "../../lib/observatory-figures";
import { all, required } from "../lib/dom";
import {
  renderSvg,
  type TrendLabels,
  trendSpec,
  type WindowLabels,
  windowSpec,
} from "../lib/observatory-charts";
import {
  byRate,
  byShare,
  formats,
  otherCells,
  rateCells,
  rateView,
  shareCells,
  shareView,
  TONE_ORDER,
  windowCells,
} from "../lib/observatory-view";

type Measure = "staff" | "students" | "residents";
type View = "regions" | "universities";

interface Payload {
  callsUrl: string;
  units: Units;
  names: Record<string, string>;
  began: string;
  today: string;
  strings: {
    classes: Record<Class, string>;
    tones: Record<Tone, string>;
    tonesShare: Record<Tone, string>;
    per: Record<Measure, string>;
    measures: Record<Measure, string>;
    national: string;
    nationalShare: string;
    region: string;
    university: string;
    period: string;
    short: string;
    undated: string;
    loading: string;
    error: string;
    window: WindowLabels;
    trend: TrendLabels & { leadMonth: string; leadYear: string };
    groups: Record<Group, string>;
  };
}

const source = document.getElementById("observatory-data");
if (source?.textContent) init(JSON.parse(source.textContent) as Payload);

function init(data: Payload): void {
  const lang = document.documentElement.lang;
  const f = formats(lang);
  const s = data.strings;
  const name = (code: string) => data.names[code] ?? code;
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const date = new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  // Shown until the reader picks another period: the build's own figures.
  let current: Figures | null = null;

  /** Colours a map's regions or circles by their distance from the average, and titles them. */
  function paint(
    map: HTMLElement,
    view: View,
    rows: { code: string; tone: Tone }[],
    title: (code: string) => string,
  ): void {
    const tones = new Map(rows.map((r) => [r.code, r.tone]));
    map.dataset.view = view;
    const selector = view === "regions" ? "path[data-code]" : "circle[data-code]";
    for (const shape of all(selector, SVGElement, map)) {
      const code = shape.dataset.code ?? "";
      for (const tone of TONE_ORDER) shape.classList.remove(`obs-${tone}`);
      shape.classList.add(`obs-${tones.get(code) ?? "none"}`);
      const tip = shape.querySelector("title");
      if (tip) tip.textContent = tones.has(code) ? title(code) : name(code);
    }
  }

  /** Refills a table's body (first cell a row header, the result last, figures in between). */
  function fill(
    table: HTMLTableElement,
    rows: { cells: string[]; result?: boolean }[],
    headers: Record<number, string> = {},
  ): void {
    const head = all("thead th", HTMLTableCellElement, table);
    for (const [i, text] of Object.entries(headers)) {
      const cell = head[Number(i)];
      if (cell) cell.textContent = text;
    }
    table.tBodies[0]?.replaceChildren(
      ...rows.map((row) => {
        const tr = document.createElement("tr");
        row.cells.forEach((text, i) => {
          const cell = document.createElement(i === 0 ? "th" : "td");
          const last = i === row.cells.length - 1;
          if (i === 0) cell.setAttribute("scope", "row");
          else if (!(row.result && last)) cell.className = "num";
          cell.append(text);
          tr.append(cell);
        });
        return tr;
      }),
    );
  }

  const choice = (form: HTMLFormElement, field: string) =>
    (new FormData(form).get(field) as string | null) ?? "";

  // --- Territory: positions per denominator --------------------------------------------------
  const territory = required('[data-controls="territory"]', HTMLFormElement);
  const territoryMap = required('[data-map="territory"]', HTMLElement);
  const territoryTable = required('[data-table="territory"]', HTMLTableElement);
  const national = required('[data-national="territory"]', HTMLElement);
  const residentsNote = required("[data-residents-note]", HTMLElement, territory);
  const viewInput = (form: HTMLFormElement, value: View) =>
    required(`input[name="view"][value="${value}"]`, HTMLInputElement, form);
  const rateHeader = all("thead th", HTMLTableCellElement, territoryTable)[3];
  const rateWord = rateHeader?.textContent?.replace(/\s*\(.*\)$/, "") ?? "";

  function drawTerritory(): void {
    if (!current) return;
    const measure = choice(territory, "measure") as Measure;
    // Residents are counted by region only.
    viewInput(territory, "universities").disabled = measure === "residents";
    residentsNote.hidden = measure !== "residents";
    if (measure === "residents") viewInput(territory, "regions").checked = true;
    const view = choice(territory, "view") as View;
    const variant = current.territory[`${choice(territory, "group")}/${measure}`];
    if (!variant) return;
    const rows = variant[view].rows.map(rateView);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    paint(territoryMap, view, rows, (code) => {
      const r = byCode.get(code);
      return r
        ? `${name(code)}: ${f.decimal(r.rate)} ${s.per[measure]} · ${s.tones[r.tone]}`
        : name(code);
    });
    fill(
      territoryTable,
      byRate(rows).map((r) => ({
        result: true,
        cells: rateCells(r, name(r.code), s.classes[r.class], f),
      })),
      {
        0: view === "regions" ? s.region : s.university,
        2: capitalize(s.measures[measure]),
        3: `${rateWord} (${s.per[measure]})`,
      },
    );
    national.textContent = format(s.national, {
      rate: f.decimal(variant.regions.national),
      unit: s.per[measure],
    });
  }

  // --- Precarity: the share of precarious positions ------------------------------------------
  const precarity = required('[data-controls="precarity"]', HTMLFormElement);
  const precarityMap = required('[data-map="precarity"]', HTMLElement);
  const precarityTable = required('[data-table="precarity"]', HTMLTableElement);
  const nationalShare = required('[data-national="precarity"]', HTMLElement);

  function drawPrecarity(): void {
    if (!current) return;
    const view = choice(precarity, "view") as View;
    const rows = current.precarity[view].rows.map(shareView);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    paint(precarityMap, view, rows, (code) => {
      const r = byCode.get(code);
      return r ? `${name(code)}: ${f.percent(r.share)} · ${s.tonesShare[r.tone]}` : name(code);
    });
    fill(
      precarityTable,
      byShare(rows).map((r) => ({
        result: true,
        cells: shareCells(r, name(r.code), s.classes[r.class], f),
      })),
      { 0: view === "regions" ? s.region : s.university },
    );
    nationalShare.textContent = format(s.nationalShare, {
      share: f.percent(current.precarity.regions.national),
    });
  }

  territory.addEventListener("change", drawTerritory);
  precarity.addEventListener("change", drawPrecarity);

  // --- Everything that depends on the period ------------------------------------------------
  const range = required("[data-range]", HTMLFormElement);
  const from = required('input[name="from"]', HTMLInputElement, range);
  const to = required('input[name="to"]', HTMLInputElement, range);
  const status = required("[data-range-status]", HTMLElement, range);
  const csvLinks = new Map(
    all("[data-csv]", HTMLAnchorElement).map((a) => [a.dataset.csv ?? "", a]),
  );
  const csvUrls: string[] = [];

  function drawPeriod(fig: Figures): void {
    const p = fig.period;
    required("[data-period]", HTMLElement, range).textContent = format(s.period, {
      start: date.format(p.start),
      end: date.format(p.end),
    });
    required('[data-stat="calls"]', HTMLElement).textContent = f.integer(fig.calls);
    required('[data-stat="days"]', HTMLElement).textContent = String(p.days);
    const short = required("[data-short]", HTMLElement);
    short.hidden = !p.short;
    short.textContent = format(s.short, { days: p.days });

    fill(
      required('[data-table="others"]', HTMLTableElement),
      fig.others.map((o) => ({ cells: otherCells(o, f) })),
    );
    renderSvg(
      required('[data-chart="window"]', SVGSVGElement),
      windowSpec(fig.windows.groups, s.window, lang),
    );
    required("[data-undated]", HTMLElement).textContent =
      fig.windows.undated > 0 ? format(s.undated, { n: f.integer(fig.windows.undated) }) : "";
    fill(
      required('[data-table="window"]', HTMLTableElement),
      windowCells(fig.windows.universities, f).map((cells) => ({ cells })),
    );
    required("[data-trend-lead]", HTMLElement).textContent =
      fig.trend.granularity === "year" ? s.trend.leadYear : s.trend.leadMonth;
    for (const group of GROUP_KEYS) {
      renderSvg(
        required(`[data-chart="trend-${group}"]`, SVGSVGElement),
        trendSpec(fig.trend, group, s.groups[group], s.trend, lang),
      );
    }
    required("[data-partial-note]", HTMLElement).hidden = !fig.trend.buckets.some((b) => b.partial);

    // The downloads follow the period too.
    for (const url of csvUrls.splice(0)) URL.revokeObjectURL(url);
    for (const file of CSV_FILES) {
      const link = csvLinks.get(file);
      if (!link) continue;
      const url = URL.createObjectURL(new Blob([csvTable(file, fig)], { type: "text/csv" }));
      csvUrls.push(url);
      link.href = url;
      link.download = csvName(file, fig);
    }
  }

  let calls: ReturnType<typeof expand> | null = null;
  async function load(): Promise<ReturnType<typeof expand>> {
    if (!calls) {
      const resp = await fetch(data.callsUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      calls = expand((await resp.json()) as CompactCalls);
    }
    return calls;
  }

  /** The period in the URL (?dal=…&al=…), if any: shared links open on it. */
  function fromUrl(): Range {
    const params = new URLSearchParams(location.search);
    return { from: params.get("dal") ?? undefined, to: params.get("al") ?? undefined };
  }

  async function apply(wanted: Range, remember: boolean): Promise<void> {
    status.hidden = false;
    status.textContent = s.loading;
    try {
      // The build's day is "today": the figures must not depend on when the page is read.
      const fig = figures(
        await load(),
        data.units,
        new Date(`${data.today}T23:59:59.999Z`),
        wanted,
      );
      current = fig;
      // The inputs show the period actually used (a range out of bounds falls back to the default).
      from.value = fig.period.start.toISOString().slice(0, 10);
      to.value = fig.period.end.toISOString().slice(0, 10);
      if (remember) {
        const url = new URL(location.href);
        const isDefault = from.value === data.began && to.value === data.today;
        url.searchParams.delete("dal");
        url.searchParams.delete("al");
        if (!isDefault) {
          url.searchParams.set("dal", from.value);
          url.searchParams.set("al", to.value);
        }
        history.replaceState(null, "", url);
      }
      drawPeriod(fig);
      drawTerritory();
      drawPrecarity();
      status.hidden = true;
    } catch {
      status.textContent = s.error;
    }
  }

  range.addEventListener("change", () => {
    void apply({ from: from.value, to: to.value }, true);
  });
  range.addEventListener("submit", (event) => event.preventDefault());
  for (const button of all(".obs-preset", HTMLButtonElement, range)) {
    button.addEventListener("click", () => {
      if (button.dataset.lastYear !== undefined) {
        const end = new Date(`${data.today}T00:00:00Z`);
        const start = new Date(end.getTime() - 364 * 86_400_000);
        void apply({ from: start.toISOString().slice(0, 10), to: data.today }, true);
      } else {
        void apply({ from: button.dataset.from, to: button.dataset.to }, true);
      }
    });
  }

  void apply(fromUrl(), false);
}
