import type { ArchivedCall } from "@postthedoc/shared/archive";
import { describe, expect, it } from "vitest";
import { MEASURES, observatory } from "../src/lib/observatory-data";
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

  it("compares universities with their real denominators", () => {
    expect(data.universities).toBe(100);
    const staff = data.territory["permanent/staff"];
    expect(staff?.universities.rows).toHaveLength(100);
    expect(staff?.regions.rows.find((r) => r.code === "IT-82")?.observed).toBe(40);
    // The online university counts among the universities, not in its region.
    expect(staff?.universities.rows.find((r) => r.code === "PEGASO")?.observed).toBe(1);
    expect(staff?.regions.rows.find((r) => r.code === "IT-72")?.observed).toBe(0);
    for (const measure of MEASURES) {
      expect(data.territory[`phd/${measure}`]).toBeDefined();
    }
    expect(data.territory["permanent/residents"]?.universities.rows).toEqual([]);
  });

  it("lists institutions without a denominator apart", () => {
    expect(data.others).toEqual([
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

  it("sorts by result, then by ratio", () => {
    const rows = [
      { code: "a", class: "in-line", ratio: 1.1 },
      { code: "b", class: "insufficient", ratio: 9 },
      { code: "c", class: "much-higher", ratio: 2 },
      { code: "d", class: "in-line", ratio: 1.3 },
    ].map((r) => ({ observed: 0, denominator: 1, rate: 0, low: 0, high: 0, ...r }) as never);
    expect(byRate(rows).map((r: { code: string }) => r.code)).toEqual(["c", "d", "a", "b"]);
  });
});
