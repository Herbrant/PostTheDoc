import type { ArchivedCall } from "@postthedoc/shared/archive";
import { describe, expect, it } from "vitest";
import {
  byar,
  classify,
  count,
  counted,
  level,
  monthly,
  overdispersion,
  period,
  precarity,
  rates,
  shares,
  type University,
  wilson,
  windowDays,
  windows,
} from "../src/lib/observatory";

const NOW = new Date("2026-10-02T08:00:00Z");

function call(fields: Partial<ArchivedCall> = {}): ArchivedCall {
  return {
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
  };
}

const UNIVERSITIES: University[] = [
  { code: "UNICT", name: "Catania", region: "IT-82", online: false, staff: 1000, students: 40000 },
  { code: "UNIPA", name: "Palermo", region: "IT-82", online: false, staff: 1500, students: 45000 },
  { code: "NORMALE", name: "Normale", region: "IT-52", online: false, staff: 100, students: null },
  { code: "PEGASO", name: "Pegaso", region: "IT-72", online: true, staff: 300, students: 90000 },
];
const BY_CODE = new Map(UNIVERSITIES.map((u) => [u.code, u]));
const REGIONS = new Map([
  ["IT-82", "Sicilia"],
  ["IT-52", "Toscana"],
  ["IT-72", "Campania"],
]);
const DENOMINATORS = {
  universities: {},
  regions: { "IT-82": { residents: 4_800_000 }, "IT-52": { residents: 3_600_000 } },
};

describe("intervals", () => {
  it("matches the exact Poisson interval (Byar)", () => {
    const [low, high] = byar(10);
    expect(low).toBeCloseTo(4.795, 1);
    expect(high).toBeCloseTo(18.39, 1);
    expect(byar(0)[0]).toBe(0);
    expect(byar(0)[1]).toBeCloseTo(3.689, 1);
  });

  it("computes Wilson's interval", () => {
    const [low, high] = wilson(10, 20);
    expect(low).toBeCloseTo(0.299, 2);
    expect(high).toBeCloseTo(0.701, 2);
    expect(wilson(0, 0)).toEqual([0, 0]);
  });
});

describe("overdispersion", () => {
  it("is 1 for scores as spread as expected, or too few units", () => {
    expect(overdispersion([1, -1, 1, -1, 1, -1, 1, -1, 1, -1])).toBe(1);
    expect(overdispersion([10, -10])).toBe(1);
  });

  it("is the mean square of the winsorised scores", () => {
    const zs = [-3, -2, -2, -2, -2, 2, 2, 2, 2, 20];
    // 10%: the lowest becomes -2, the highest 2.
    expect(overdispersion(zs)).toBeCloseTo(4, 6);
  });
});

describe("classify", () => {
  it.each([
    [null, "insufficient"],
    [0, "in-line"],
    [1.95, "in-line"],
    [1.96, "higher"],
    [-2, "lower"],
    [3.09, "much-higher"],
    [-4, "much-lower"],
  ] as const)("%s -> %s", (z, expected) => {
    expect(classify(z)).toBe(expected);
  });
});

describe("rates", () => {
  it("compares each unit with the national rate of all units", () => {
    const result = rates(
      [
        { code: "A", name: "A", observed: 30, denominator: 100 },
        { code: "B", name: "B", observed: 10, denominator: 100 },
        { code: "C", name: "C", observed: 1, denominator: 10 },
        { code: "D", name: "D", observed: 0, denominator: 0 },
      ],
      100,
    );
    expect(result.national).toBeCloseTo((41 / 210) * 100, 6);
    const [a, b, c] = result.rows;
    expect(result.rows).toHaveLength(3); // no denominator: left out
    expect(a?.rate).toBe(30);
    expect(a?.expected).toBeCloseTo((41 / 210) * 100, 6);
    expect(a?.low).toBeLessThan(30);
    expect(a?.high).toBeGreaterThan(30);
    expect(a?.class).toBe("higher");
    expect(b?.class).toBe("lower");
    expect(c?.class).toBe("insufficient"); // fewer than 5 expected positions
  });
});

describe("shares", () => {
  it("compares each unit with the national share", () => {
    const result = shares([
      { code: "A", name: "A", part: 90, total: 100 },
      { code: "B", name: "B", part: 50, total: 100 },
      { code: "C", name: "C", part: 1, total: 2 },
    ]);
    expect(result.national).toBeCloseTo(141 / 202, 6);
    expect(result.rows[0]?.class).toBe("much-higher");
    expect(result.rows[1]?.class).toBe("much-lower");
    expect(result.rows[2]?.class).toBe("insufficient");
  });
});

describe("counting", () => {
  const calls = [
    call({ positions: 3 }),
    call({ institutionCode: "UNIPA", positions: null }),
    call({ role: "phd", positions: 30 }),
    call({ role: "research_fellowship", institutionCode: "CNR", institution: "CNR-IAC" }),
    call({ withdrawn: true }),
    call({ role: "unknown" }),
    call({ published: "2024-01-01" }),
  ];

  it("counts positions of the period per group, one when unstated", () => {
    const p = period(calls, NOW);
    const result = count(counted(calls, p), BY_CODE);
    expect(result.universities.get("UNICT")).toEqual({ permanent: 3, precarious: 0, phd: 30 });
    expect(result.universities.get("UNIPA")?.permanent).toBe(1);
    expect(result.others.get("CNR-IAC")?.precarious).toBe(1);
    expect(result.calls).toBe(4);
    expect(result.imputed).toBe(1);
  });

  it("starts when the archive began, or a year ago", () => {
    const young = period([call()], NOW);
    expect(young.preliminary).toBe(true);
    expect(young.start).toEqual(new Date("2026-09-25T09:00:00Z"));
    expect(young.days).toBe(6);
    const old = period([call({ firstSeen: new Date("2025-01-01T00:00:00Z") })], NOW);
    expect(old.preliminary).toBe(false);
    expect(old.start).toEqual(new Date("2025-10-02T08:00:00Z"));
  });

  it("leaves out calls issued before the archive began", () => {
    const calls = [call(), call({ published: "2026-09-20" }), call({ published: null })];
    expect(counted(calls, period(calls, NOW))).toHaveLength(2);
  });
});

describe("level", () => {
  const counts = count(
    [
      call({ positions: 10 }),
      call({ institutionCode: "UNIPA", positions: 20 }),
      call({ institutionCode: "NORMALE", region: "IT-52", positions: 5 }),
      call({ institutionCode: "PEGASO", region: "IT-72", positions: 7 }),
    ],
    BY_CODE,
  );

  it("sums a region's universities, online ones excepted", () => {
    const staff = level(counts, UNIVERSITIES, DENOMINATORS, "permanent", "staff", REGIONS);
    expect(staff.universities.map((u) => u.code)).toEqual(["UNICT", "UNIPA", "NORMALE", "PEGASO"]);
    expect(staff.regions).toEqual([
      { code: "IT-82", name: "Sicilia", observed: 30, denominator: 2500 },
      { code: "IT-52", name: "Toscana", observed: 5, denominator: 100 },
    ]);
  });

  it("leaves out universities without the denominator, on both sides", () => {
    const students = level(counts, UNIVERSITIES, DENOMINATORS, "permanent", "students", REGIONS);
    expect(students.universities.map((u) => u.code)).not.toContain("NORMALE");
    expect(students.regions.map((r) => r.code)).toEqual(["IT-82"]);
  });

  it("divides regions by their residents", () => {
    const residents = level(counts, UNIVERSITIES, DENOMINATORS, "permanent", "residents", REGIONS);
    expect(residents.universities).toEqual([]);
    expect(residents.regions[0]).toEqual({
      code: "IT-82",
      name: "Sicilia",
      observed: 30,
      denominator: 4_800_000,
    });
  });

  it("measures precarity per university and region", () => {
    const mixed = count(
      [call({ positions: 2 }), call({ role: "research_fellowship", positions: 6 })],
      BY_CODE,
    );
    const result = precarity(mixed, UNIVERSITIES, REGIONS);
    expect(result.universities[0]).toEqual({ code: "UNICT", name: "Catania", part: 6, total: 8 });
    expect(result.regions.find((r) => r.code === "IT-82")).toEqual({
      code: "IT-82",
      name: "Sicilia",
      part: 6,
      total: 8,
    });
  });
});

describe("application window", () => {
  it("counts calendar days in Italian time", () => {
    // 00:30 in Rome is still the day before in UTC: Rome's date counts.
    expect(windowDays(call({ deadline: new Date("2026-10-20T22:30:00Z") }))).toBe(25);
    expect(windowDays(call({ deadline: new Date("2026-10-19T22:30:00Z") }))).toBe(24);
    expect(windowDays(call({ published: null }))).toBeNull();
  });

  it("groups windows and summarises universities with enough calls", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      call({ deadline: new Date(`2026-10-${String(1 + i).padStart(2, "0")}T10:00:00Z`) }),
    );
    const result = windows([...many, call({ published: null })], BY_CODE);
    const permanent = result.groups.find((g) => g.group === "permanent");
    expect(permanent?.buckets).toEqual([10, 0, 0, 0]); // 5 to 14 days
    expect(permanent?.median).toBe(9.5);
    expect(result.undated).toBe(1);
    expect(result.universities).toEqual([
      { code: "UNICT", name: "Catania", calls: 10, median: 9.5, short: 1 },
    ]);
  });
});

describe("monthly", () => {
  it("counts calls and positions per month and group", () => {
    const result = monthly([
      call({ published: "2026-09-01", positions: 2 }),
      call({ published: "2026-10-01", role: "phd", positions: null }),
      call({ published: "2026-09-30" }),
    ]);
    expect(result.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    expect(result[0]?.positions.permanent).toBe(3);
    expect(result[0]?.calls.permanent).toBe(2);
    expect(result[1]?.positions.phd).toBe(1);
  });
});
