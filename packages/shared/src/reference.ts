/**
 * Reference tables shared with the Python pipeline: the source of truth is data/reference/*.json.
 * The tables are validated when this module loads, so malformed data fails the build and the tests.
 */
import { z } from "zod";
import institutionsJson from "../../../data/reference/institutions.json";
import regionsJson from "../../../data/reference/regions.json";
import rolesJson from "../../../data/reference/roles.json";
import sectorsJson from "../../../data/reference/sectors.json";
import { INSTITUTION_TYPES } from "./contract";

const localized = z.object({ it: z.string().min(1), en: z.string().min(1) });

const roleSchema = z.object({ code: z.string(), name: localized, description: localized });
const regionSchema = z.object({ code: z.string().regex(/^IT-\d{2}$/), name: localized });
const institutionSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.enum(INSTITUTION_TYPES),
  region: z.string().nullable(),
});
const sectorsSchema = z.object({
  areas: z.array(z.object({ code: z.string(), name: localized })),
  groups: z.array(z.object({ code: z.string(), area: z.string(), name: z.string() })),
});

export type Role = z.infer<typeof roleSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Institution = z.infer<typeof institutionSchema>;
export type Sectors = z.infer<typeof sectorsSchema>;
export type SectorArea = Sectors["areas"][number];
export type SectorGroup = Sectors["groups"][number];

/** Roles, in display order. */
export const roles: readonly Role[] = z.array(roleSchema).parse(rolesJson);
export const regions: readonly Region[] = z.array(regionSchema).parse(regionsJson);
export const institutions: readonly Institution[] = z
  .array(institutionSchema)
  .parse(institutionsJson);
/** Scientific areas and their G.S.D. (gruppi scientifico-disciplinari). */
export const sectors: Sectors = sectorsSchema.parse(sectorsJson);

const codes = (items: readonly { code: string }[]): ReadonlySet<string> =>
  new Set(items.map((item) => item.code));

export const roleCodes = codes(roles);
export const regionCodes = codes(regions);
export const gsdCodes = codes(sectors.groups);
export const institutionCodes = codes(institutions);
