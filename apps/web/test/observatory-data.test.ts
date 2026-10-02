import type { ArchivedCall } from "@postthedoc/shared/archive";
import { describe, expect, it } from "vitest";
import { compact, expand } from "../src/lib/observatory-calls";
import { csvName, csvTable } from "../src/lib/observatory-csv";
import { observatory } from "../src/lib/observatory-data";
import { figures, MEASURES } from "../src/lib/observatory-figures";
import { trendSpec, windowSpec } from "../src/scripts/lib/observatory-charts";
import { byRate, formats, rateCells, rateView } from "../src/scripts/lib/observatory-view";

const NOW = new Date("2026-10-02T08:00:00Z");

const call = (fields: Partial<ArchivedCall>): ArchivedCall => ({
  id: "mur-jobs-1",
  role: "researcher",
  title: "RTT",
  institution: "Univ. CATANIA",
  institutionCode: "UNICT",
  region: "IT-82",
  gsd: [],
  positions: 1,
  published: "2026-09-26",
  deadline: new Date("2026-10-20T10:00:00Z"),
  firstSeen: new Date("2026-09-25T09:00:00Z"),
  withdrawn: false,
  ...fields,
});

describe("observatory", () => {
  const data = observatory(
    [
      call({ positions: 40 }),
      call({ institutionCode: "UNIMI", institution: "Univ. MILANO", region: "IT-25" }),
      call({ institutionCode: "CNR", institution: "CNR-IAC", region: null, role: "phd" }),
      call({ institutionCode: "PEGASO", institution: "Telematica PEGASO", region: "IT-72" }),
    ],
    "it",
    NOW,
  );

  const fig = data.figures;

  it("compares universities with their real denominators", () => {
    expect(fig.universities).toBe(100);
    const staff = fig.territory["permanent/staff"];
    expect(staff?.universities.rows).toHaveLength(100);
    expect(staff?.regions.rows.find((r) => r.code === "IT-82")?.observed).toBe(40);
    // The online university counts among the universities, not in its region.
    expect(staff?.universities.rows.find((r) => r.code === "PEGASO")?.observed).toBe(1);
    expect(staff?.regions.rows.find((r) => r.code === "IT-72")?.observed).toBe(0);
    for (const measure of MEASURES) {
      expect(fig.territory[`phd/${measure}`]).toBeDefined();
    }
    expect(fig.territory["permanent/residents"]?.universities.rows).toEqual([]);
  });

  it("lists institutions without a denominator apart", () => {
    expect(fig.others).toEqual([
      { name: "CNR-IAC", counts: { permanent: 0, precarious: 0, phd: 1 } },
    ]);
  });

  it("draws every region and every university not online", () => {
    expect(data.map.regions).toHaveLength(20);
    expect(data.map.universities.length).toBeGreaterThan(80);
    expect(data.map.universities.map((p) => p.code)).not.toContain("PEGASO");
    for (const p of data.map.universities) {
      expect(p.x).toBeGreaterThanOrEqual(-20);
      expect(p.x).toBeLessThanOrEqual(data.map.width + 20);
      expect(p.y).toBeGreaterThanOrEqual(-20);
      expect(p.y).toBeLessThanOrEqual(data.map.height + 20);
    }
  });

  it("packs the universities of a city without overlaps", () => {
    const rome = ["ROMA1", "ROMA2", "ROMA3", "LUISS", "LUMSA"].map((code) =>
      data.map.universities.find((p) => p.code === code),
    );
    for (const [i, a] of rome.entries()) {
      for (const b of rome.slice(i + 1)) {
        if (!a || !b) throw new Error("missing");
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });
});

describe("the browser's side", () => {
  const calls = [
    call({ positions: 40 }),
    call({ institutionCode: null, institution: "CNR-IAC", role: "phd", positions: null }),
    call({ withdrawn: true }),
  ];
  const data = observatory(calls, "it", NOW);

  it("gets back the calls it needs from their compact form", () => {
    const back = expand(JSON.parse(JSON.stringify(compact(calls))));
    expect(back).toHaveLength(2); // the withdrawn call never counts
    expect(back[0]).toMatchObject({
      role: "researcher",
      institutionCode: "UNICT",
      positions: 40,
      published: "2026-09-26",
      deadline: calls[0]?.deadline,
      firstSeen: calls[0]?.firstSeen,
    });
    expect(back[1]).toMatchObject({
      institution: "CNR-IAC",
      institutionCode: null,
      positions: null,
    });
  });

  it("computes the same figures as the build", () => {
    const again = figures(expand(compact(calls)), data.units, NOW);
    expect(csvTable("territory", again)).toBe(csvTable("territory", data.figures));
    expect(csvTable("trend", again)).toBe(csvTable("trend", data.figures));
  });

  it("names the CSV files after the period", () => {
    const fig = figures(calls, data.units, NOW, { from: "2026-09-26", to: "2026-09-30" });
    expect(csvName("territory", fig)).toBe("territory_2026-09-26_2026-09-30.csv");
    expect(csvTable("trend", fig).split("\n")[1]).toBe("2026-09,permanent,1,40,true");
  });

  it("draws partial buckets dashed, with a note in their title", () => {
    const spec = trendSpec(
      data.figures.trend,
      "permanent",
      "Strutturati",
      { partialMonth: "mese parziale", partialYear: "anno parziale" },
      "it",
    );
    const bars = spec.nodes.filter((n) => n.tag === "rect");
    expect(bars).toHaveLength(data.figures.trend.buckets.length);
    // September 2026, when the collection began, is whole; October, still going, is not.
    expect(bars[0]?.attrs?.class).toBe("obs-bar");
    expect(bars[0]?.children?.[0]?.text).toBe("set 26: 40");
    expect(bars[1]?.attrs?.class).toBe("obs-bar obs-bar-partial");
    expect(bars[1]?.children?.[0]?.text).toBe("ott 26: 0 (mese parziale)");
  });

  it("draws one bar per group of positions for the windows", () => {
    const spec = windowSpec(
      data.figures.windows.groups,
      {
        groups: { permanent: "A", precarious: "B", phd: "C" },
        buckets: ["<15", "15-29", "30-59", "60+"],
        median: "mediana {n}",
        calls: "{n} bandi",
        callsOne: "1 bando",
        label: "Finestre",
      },
      "it",
    );
    expect(spec.nodes).toHaveLength(3);
    expect(spec.viewBox).toBe("0 0 640 180");
  });
});

describe("observatory tables", () => {
  const f = formats("it");

  it("formats a row", () => {
    const row = rateView({
      code: "UNICT",
      name: "Catania",
      observed: 1234,
      denominator: 1000,
      rate: 123.456,
      low: 116.5,
      high: 130.81,
      expected: 1000,
      ratio: 1.234,
      z: 3.5,
      class: "much-higher",
      tone: "higher",
    });
    expect(rateCells(row, "Univ. CATANIA", "Molto sopra", f)).toEqual([
      "Univ. CATANIA",
      "1234",
      "1000",
      "123",
      "117 – 131",
      "1,23",
      "Molto sopra",
    ]);
  });

  it("sorts by ratio, those without a figure last", () => {
    const rows = [
      { code: "a", tone: "in-line", ratio: 1.1 },
      { code: "b", tone: "none", ratio: 9 },
      { code: "c", tone: "much-higher", ratio: 2 },
      { code: "d", tone: "in-line", ratio: 1.3 },
    ].map(
      (r) =>
        ({
          observed: 0,
          denominator: 1,
          rate: 0,
          low: 0,
          high: 0,
          class: "in-line",
          ...r,
        }) as never,
    );
    expect(byRate(rows).map((r: { code: string }) => r.code)).toEqual(["c", "d", "a", "b"]);
  });
});
