import { describe, expect, it } from "vitest";
import { institutions, regionCodes, regions, roles, sectors } from "../src/reference";

const duplicates = (codes: string[]) => codes.filter((code, i) => codes.indexOf(code) !== i);

describe("reference tables", () => {
  it("have unique codes", () => {
    for (const table of [roles, regions, institutions, sectors.areas, sectors.groups]) {
      expect(duplicates(table.map((item) => item.code))).toEqual([]);
    }
  });

  it("point to known regions and areas", () => {
    const areas = new Set(sectors.areas.map((a) => a.code));
    for (const i of institutions) if (i.region) expect(regionCodes).toContain(i.region);
    for (const g of sectors.groups) expect(areas).toContain(g.area);
  });

  it("list the 20 Italian regions", () => {
    expect(regions).toHaveLength(20);
  });
});
