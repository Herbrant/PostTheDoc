// Observatory page: redraws the maps and tables when the reader picks the positions, the
// denominator or the level to show. Everything was computed at build time (lib/observatory.ts):
// the page embeds every variant, this only switches between them.
import { format } from "../../i18n/format";
import type { Class } from "../../lib/observatory";
import { all, required } from "../lib/dom";
import {
  byRate,
  byShare,
  CLASS_ORDER,
  formats,
  type RateView,
  rateCells,
  type ShareView,
  shareCells,
} from "../lib/observatory-view";

type Measure = "staff" | "students" | "residents";
type View = "regions" | "universities";

interface Payload {
  territory: Record<string, { national: number; regions: RateView[]; universities: RateView[] }>;
  precarity: { national: number; regions: ShareView[]; universities: ShareView[] };
  names: Record<string, string>;
  strings: {
    classes: Record<Class, string>;
    per: Record<Measure, string>;
    measures: Record<Measure, string>;
    national: string;
    nationalShare: string;
    region: string;
    university: string;
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

  /** Colours the map's regions or circles, and titles them, from the given rows. */
  function paint(
    map: Element,
    view: View,
    rows: { code: string; class: Class }[],
    title: (code: string) => string,
  ) {
    const classes = new Map(rows.map((r) => [r.code, r.class]));
    (map as HTMLElement).dataset.view = view;
    const selector = view === "regions" ? "path[data-code]" : "circle[data-code]";
    for (const shape of all(selector, SVGElement, map)) {
      const code = shape.dataset.code ?? "";
      for (const c of CLASS_ORDER) shape.classList.remove(`obs-${c}`);
      shape.classList.remove("obs-none");
      shape.classList.add(`obs-${classes.get(code) ?? "none"}`);
      const tip = shape.querySelector("title");
      if (tip) tip.textContent = classes.has(code) ? title(code) : name(code);
    }
  }

  /** Refills a table's body (and its first and third headers) from the given cells. */
  function fill(
    table: HTMLTableElement,
    rows: { cells: string[]; class: Class }[],
    headers: Record<number, string>,
  ) {
    const head = all("thead th", HTMLTableCellElement, table);
    for (const [i, text] of Object.entries(headers)) {
      const cell = head[Number(i)];
      if (cell) cell.textContent = text;
    }
    const body = table.tBodies[0];
    if (!body) return;
    body.replaceChildren(
      ...rows.map((row) => {
        const tr = document.createElement("tr");
        row.cells.forEach((text, i) => {
          const cell = document.createElement(i === 0 ? "th" : "td");
          if (i === 0) cell.setAttribute("scope", "row");
          else if (i < row.cells.length - 1) cell.className = "num";
          else {
            const swatch = document.createElement("span");
            swatch.className = `obs-swatch obs-${row.class}`;
            swatch.setAttribute("aria-hidden", "true");
            cell.append(swatch);
          }
          cell.append(text);
          tr.append(cell);
        });
        return tr;
      }),
    );
  }

  const choice = (form: HTMLFormElement, field: string) =>
    (new FormData(form).get(field) as string | null) ?? "";

  // Territory: positions per denominator.
  const territory = required('[data-controls="territory"]', HTMLFormElement);
  const territoryMap = required('[data-map="territory"]', HTMLElement);
  const territoryTable = required('[data-table="territory"]', HTMLTableElement);
  const national = required('[data-national="territory"]', HTMLElement);
  const residentsNote = required("[data-residents-note]", HTMLElement, territory);
  const universitiesView = required(
    'input[name="view"][value="universities"]',
    HTMLInputElement,
    territory,
  );
  const regionsView = required('input[name="view"][value="regions"]', HTMLInputElement, territory);

  function drawTerritory(): void {
    const measure = choice(territory, "measure") as Measure;
    // Residents are counted by region only.
    universitiesView.disabled = measure === "residents";
    residentsNote.hidden = measure !== "residents";
    if (measure === "residents") regionsView.checked = true;
    const view = choice(territory, "view") as View;
    const variant = data.territory[`${choice(territory, "group")}/${measure}`];
    if (!variant) return;
    const rows = variant[view];
    const byCode = new Map(rows.map((r) => [r.code, r]));
    paint(territoryMap, view, rows, (code) => {
      const r = byCode.get(code);
      return r
        ? `${name(code)}: ${f.decimal(r.rate)} ${s.per[measure]} · ${s.classes[r.class]}`
        : name(code);
    });
    fill(
      territoryTable,
      byRate(rows).map((r) => ({
        class: r.class,
        cells: rateCells(r, name(r.code), s.classes[r.class], f),
      })),
      {
        0: view === "regions" ? s.region : s.university,
        2: capitalize(s.measures[measure]),
        3: `${territoryTable.dataset.rateLabel ?? ""} (${s.per[measure]})`,
      },
    );
    national.textContent = format(s.national, {
      rate: f.decimal(variant.national),
      unit: s.per[measure],
    });
  }

  // The rate column's own word, before the unit.
  const rateHeader = all("thead th", HTMLTableCellElement, territoryTable)[3];
  territoryTable.dataset.rateLabel = rateHeader?.textContent?.replace(/\s*\(.*\)$/, "") ?? "";
  territory.addEventListener("change", drawTerritory);
  drawTerritory();

  // Precarity: the share of precarious positions.
  const precarity = required('[data-controls="precarity"]', HTMLFormElement);
  const precarityMap = required('[data-map="precarity"]', HTMLElement);
  const precarityTable = required('[data-table="precarity"]', HTMLTableElement);

  function drawPrecarity(): void {
    const view = choice(precarity, "view") as View;
    const rows = data.precarity[view];
    const byCode = new Map(rows.map((r) => [r.code, r]));
    paint(precarityMap, view, rows, (code) => {
      const r = byCode.get(code);
      return r ? `${name(code)}: ${f.percent(r.share)} · ${s.classes[r.class]}` : name(code);
    });
    fill(
      precarityTable,
      byShare(rows).map((r) => ({
        class: r.class,
        cells: shareCells(r, name(r.code), s.classes[r.class], f),
      })),
      { 0: view === "regions" ? s.region : s.university },
    );
  }

  precarity.addEventListener("change", drawPrecarity);
}
