import { describe, expect, it } from "vitest";
import { openCalls } from "../src/seen";

const NOW = new Date("2026-09-24T06:00:00Z");
const call = (id: string) => ({
  role: "phd",
  title: `Call ${id}`,
  url: `https://bandi.mur.gov.it/${id}`,
  institution_name: "Univ. CATANIA",
  institution_code: "UNICT",
  region: "IT-82",
  gsd: ["INFO-01"],
});
const entry = (deadline: string | null, details = true, id = "x") => ({
  deadline,
  first_seen: "2026-09-01T06:00:00.123456Z",
  ...(details ? { call: call(id) } : {}),
});

describe("openCalls", () => {
  it("lists the open calls with details, by deadline", () => {
    const text = JSON.stringify({
      version: 3,
      calls: {
        undated: entry(null, true, "undated"),
        late: entry("2026-10-20T12:00:00+02:00", true, "late"),
        soon: entry("2026-09-25T23:59:00+02:00", true, "soon"),
        expired: entry("2026-09-23T12:00:00+02:00"),
        bare: entry("2026-09-30T12:00:00+02:00", false),
      },
      retry: {},
    });
    const calls = openCalls(text, NOW);
    expect(calls.map((c) => c.id)).toEqual(["soon", "late", "undated"]);
    expect(calls[0]).toMatchObject({
      title: "Call soon",
      institution: "Univ. CATANIA",
      institutionCode: "UNICT",
      positions: null,
      deadline: new Date("2026-09-25T21:59:00Z"),
      firstSeen: new Date("2026-09-01T06:00:00.123Z"),
    });
  });

  it("leaves out the calls withdrawn before their deadline", () => {
    const deadline = "2026-10-20T12:00:00+02:00";
    const change = (at: string, old: string, value: string) => ({
      at,
      field: "status",
      old,
      new: value,
    });
    const text = JSON.stringify({
      version: 4,
      calls: {
        withdrawn: {
          ...entry(deadline, true, "withdrawn"),
          changes: [
            { at: "2026-09-20T06:00:00Z", field: "positions", old: 1, new: 2 },
            change("2026-09-22T06:00:00Z", "open", "withdrawn"),
          ],
        },
        reopened: {
          ...entry(deadline, true, "reopened"),
          changes: [
            change("2026-09-21T06:00:00Z", "open", "withdrawn"),
            change("2026-09-22T06:00:00Z", "withdrawn", "open"),
          ],
        },
        missing: { ...entry(deadline, true, "missing"), missing_since: "2026-09-23T06:00:00Z" },
      },
      retry: {},
    });
    expect(openCalls(text, NOW).map((c) => c.id)).toEqual(["missing", "reopened"]);
  });

  it("reads version 2 files, without details", () => {
    const text = JSON.stringify({ version: 2, calls: { a: entry(null, false) } });
    expect(openCalls(text, NOW)).toEqual([]);
  });

  it("rejects files in another format", () => {
    expect(() => openCalls('{"a": "2026-10-01T14:00:00+02:00"}', NOW)).toThrow();
  });
});
