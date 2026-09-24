// Behavior of components/PreferencesForm.astro: search, summaries, reading and writing values.
import type { Locale } from "../i18n/strings";
import { selectedText, strings } from "./client";

export interface Preferences {
  locale: Locale;
  roles: string[];
  sectors: string[];
  regions: string[];
  institutions: string[];
  include_unspecified: boolean;
}

type ListField = "roles" | "sectors" | "regions" | "institutions";
const LIST_FIELDS: ListField[] = ["roles", "sectors", "regions", "institutions"];

function setupSearch(picker: HTMLElement) {
  const search = picker.querySelector<HTMLInputElement>(".picker-search")!;
  const groups = [...picker.querySelectorAll<HTMLElement>(".picker-group")];
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    for (const group of groups) {
      let visible = 0;
      for (const item of group.querySelectorAll<HTMLElement>(".picker-item")) {
        item.hidden = query !== "" && !item.dataset.search!.includes(query);
        if (!item.hidden) visible++;
      }
      group.hidden = visible === 0;
    }
  });
  // Enter in the search box must not submit the form.
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
}

export function preferencesForm(root: HTMLElement) {
  const inputs = (name: string) => [
    ...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
  ];
  const checked = (name: string) => inputs(name).filter((i) => i.checked).map((i) => i.value);
  const unspecified = inputs("include_unspecified")[0];
  const rolesError = root.querySelector<HTMLElement>("[data-roles-error]")!;
  const summary = (key: string) => root.querySelector<HTMLElement>(`[data-summary="${key}"]`)!;

  for (const picker of root.querySelectorAll<HTMLElement>("[data-picker]")) setupSearch(picker);

  const update = () => {
    const sectors = checked("sectors").length;
    summary("sectors").textContent = sectors ? selectedText(sectors) : strings.allSectors;
    const places = checked("regions").length + checked("institutions").length;
    summary("location").textContent = places ? selectedText(places) : strings.allItaly;
    if (checked("roles").length) rolesError.hidden = true;
  };
  root.addEventListener("change", update);
  update();

  return {
    get: (): Preferences => ({
      locale: checked("locale")[0] as Locale,
      roles: checked("roles"),
      sectors: checked("sectors"),
      regions: checked("regions"),
      institutions: checked("institutions"),
      include_unspecified: unspecified.checked,
    }),
    set: (prefs: Preferences) => {
      for (const field of LIST_FIELDS) {
        const wanted = new Set(prefs[field]);
        for (const input of inputs(field)) input.checked = wanted.has(input.value);
      }
      for (const input of inputs("locale")) input.checked = input.value === prefs.locale;
      unspecified.checked = prefs.include_unspecified;
      update();
    },
    /** At least one role is required; shows the error next to the roles otherwise. */
    validate: () => {
      const ok = checked("roles").length > 0;
      rolesError.hidden = ok;
      if (!ok) inputs("roles")[0].focus();
      return ok;
    },
  };
}
