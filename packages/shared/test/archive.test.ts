import { describe, expect, it } from "vitest";
import { archivedCalls } from "../src/archive";

const line = (fields: Record<string, unknown>) =>
  JSON.stringify({
    id: "mur-jobs-1",
    deadline: "2026-10-20T12:00:00+02:00",
    first_seen: "2026-09-25T09:54:58.651411Z",
    role: "researcher",
    title: "RTT",
    url: "https://bandi.mur.gov.it/x",
    institution_name: "Univ. CATANIA",
    institution_code: "UNICT",
    region: "IT-82",
    ...fields,
  });

describe("archivedCalls", () => {
  it("reads one call per line", () => {
    const text = [
      line({ positions: 2, published: "2026-09-01" }),
      "",
      line({
        id: "mur-jobs-2",
        deadline: null,
        institution_code: null,
        region: null,
        changes: [{ at: "2026-09-26T06:00:00Z", field: "status", old: "open", new: "withdrawn" }],
      }),
    ].join("\n");
    const [first, second] = archivedCalls(text);
    expect(first).toMatchObject({
      id: "mur-jobs-1",
      institutionCode: "UNICT",
      positions: 2,
      published: "2026-09-01",
      withdrawn: false,
      deadline: new Date("2026-10-20T10:00:00Z"),
    });
    expect(second).toMatchObject({
      positions: null,
      published: null,
      deadline: null,
      region: null,
      withdrawn: true,
    });
  });

  it("rejects malformed lines", () => {
    expect(() => archivedCalls('{"id": "x"}')).toThrow();
  });
});
