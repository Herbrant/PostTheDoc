// Tables shared with the Worker and the pipeline: the source of truth is data/reference/*.json.
import institutions from "../../../data/reference/institutions.json";
import regions from "../../../data/reference/regions.json";
import roles from "../../../data/reference/roles.json";
import sectors from "../../../data/reference/sectors.json";
import type { Locale } from "../i18n/strings";

export { institutions, regions, roles, sectors };

export const INSTITUTION_TYPES = [
  "university",
  "online_university",
  "research_institute",
  "afam",
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export interface PickerGroup {
  label: string;
  items: { value: string; label: string }[];
}

/** G.S.D. grouped by scientific area, in the order of sectors.json. */
export function sectorGroups(lang: Locale): PickerGroup[] {
  return sectors.areas
    .map((area) => ({
      label: `${area.code} · ${area.name[lang]}`,
      items: sectors.groups
        .filter((g) => g.area === area.code)
        .map((g) => ({ value: g.code, label: `${g.code} ${g.name}` })),
    }))
    .filter((group) => group.items.length > 0);
}

/** Institutions grouped by type, sorted by name. */
export function institutionGroups(typeLabels: Record<InstitutionType, string>): PickerGroup[] {
  return INSTITUTION_TYPES.map((type) => ({
    label: typeLabels[type],
    items: institutions
      .filter((i) => i.type === type)
      .sort((a, b) => a.name.localeCompare(b.name, "it"))
      .map((i) => ({ value: i.code, label: i.name })),
  })).filter((group) => group.items.length > 0);
}
