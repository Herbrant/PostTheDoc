import { readFileSync } from "node:fs";
import { openCalls, type SeenCall } from "@postthedoc/shared/seen";
import { describe, expect, it } from "vitest";
import { byMonth, callViews, deadlineParts, latest, seenFile } from "../src/lib/calls";
import { daysLeft } from "../src/scripts/lib/deadline";

const call = (id: string, fields: Partial<SeenCall> = {}): SeenCall => ({
  id,
  role: "phd",
  title: `Call ${id}`,
  url: `https://bandi.mur.gov.it/${id}`,
  institution: "Univ. CATANIA",
  institutionCode: "UNICT",
  region: "IT-82",
  gsd: ["INFO-01", "IINF-05"],
  positions: 2,
  deadline: new Date("2026-10-01T10:00:00Z"),
  firstSeen: new Date("2026-09-20T06:00:00Z"),
  ...fields,
});

describe("the open calls page", () => {
  it("reads the committed registry", () => {
    expect(() => openCalls(readFileSync(seenFile(), "utf-8"), new Date())).not.toThrow();
  });

  it("names roles, regions and sectors in the page's language", () => {
    const [view] = callViews([call("a")], "en");
    expect(view).toMatchObject({ roleName: "PhD", regionName: "Sicily" });
    expect(view?.areas).toEqual(["01", "09"]);
    expect(view?.sectors[0]).toEqual({ code: "INFO-01", name: "Informatica" });
  });

  it("keeps unknown codes as they are", () => {
    const [view] = callViews([call("a", { role: "new", region: null, gsd: ["NOPE-01"] })], "it");
    expect(view).toMatchObject({ roleName: "new", regionName: null, areas: [] });
  });

  it("groups calls by the month of their deadline in Italy", () => {
    const calls = callViews(
      [
        call("a", { deadline: new Date("2026-09-30T22:30:00Z") }), // October 1st in Italy
        call("b", { deadline: new Date("2026-10-20T10:00:00Z") }),
        call("c", { deadline: null }),
      ],
      "it",
    );
    const months = byMonth(calls, "it", "Senza scadenza");
    expect(months.map((m) => [m.key, m.label, m.calls.map((c) => c.id)])).toEqual([
      ["2026-10", "Ottobre 2026", ["a", "b"]],
      ["", "Senza scadenza", ["c"]],
    ]);
  });

  it("picks the calls found most recently", () => {
    const early = new Date("2026-09-01T06:00:00Z");
    const calls = callViews(
      [call("a"), call("b", { firstSeen: early }), call("c"), call("d", { firstSeen: early })],
      "it",
    );
    expect(latest(calls, 3).map((c) => c.id)).toEqual(["a", "c", "b"]);
  });

  it("shows deadlines in Italian time", () => {
    const parts = deadlineParts(new Date("2026-09-30T22:30:00Z"), "it");
    expect(parts).toMatchObject({ day: "01", month: "ott", time: "00:30" });
  });
});

describe("daysLeft", () => {
  const now = new Date("2026-09-29T21:00:00Z"); // 23:00 in Italy

  it.each([
    ["2026-09-29T21:59:00Z", 0],
    ["2026-09-29T22:00:00Z", 1], // midnight in Italy
    ["2026-10-05T10:00:00Z", 6],
    ["2026-09-28T10:00:00Z", -1],
  ])("counts Italian calendar days to %s", (deadline, days) => {
    expect(daysLeft(new Date(deadline), now)).toBe(days);
  });
});
