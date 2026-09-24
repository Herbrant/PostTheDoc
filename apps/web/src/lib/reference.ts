// Tables shared with the Worker and the pipeline: the source of truth is data/reference/*.json.
import { INSTITUTION_TYPES, type InstitutionType } from "@postthedoc/shared/contract";
import { institutions, sectors } from "@postthedoc/shared/reference";
import type { Locale } from "../i18n";

export { institutions, regions, roles, sectors } from "@postthedoc/shared/reference";

export interface PickerGroup {
  /** Short code shown before the label (e.g. the scientific area "01"). */
  code?: string;
  label: string;
  items: { value: string; label: string }[];
}

/** G.S.D. grouped by scientific area, in the order of sectors.json. */
export function sectorGroups(lang: Locale): PickerGroup[] {
  return sectors.areas
    .map((area) => ({
      code: area.code,
      label: area.name[lang],
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
      .toSorted((a, b) => a.name.localeCompare(b.name, "it"))
      .map((i) => ({ value: i.code, label: i.name })),
  })).filter((group) => group.items.length > 0);
}
