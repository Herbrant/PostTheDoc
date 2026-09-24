// Tables shared with the Python pipeline: the source of truth is data/reference/*.json.
import institutions from "../../data/reference/institutions.json";
import regions from "../../data/reference/regions.json";
import roles from "../../data/reference/roles.json";
import sectors from "../../data/reference/sectors.json";

export const reference = { roles, regions, sectors, institutions };

export const roleCodes = new Set(roles.map((r) => r.code));
export const regionCodes = new Set(regions.map((r) => r.code));
export const gsdCodes = new Set(sectors.groups.map((g) => g.code));
export const institutionCodes = new Set(institutions.map((i) => i.code));
