/** Behavior of components/forms/PreferencesForm.astro: summaries, reading and writing values. */
import type { PreferenceList, Preferences } from "@postthedoc/shared/api";
import { isLocale } from "@postthedoc/shared/contract";
import { all, required } from "../lib/dom";
import { selectedText, strings } from "../lib/strings";
import { setupPicker } from "./picker";

const LISTS: PreferenceList[] = ["roles", "sectors", "regions", "institutions"];

export interface PreferencesForm {
  get(): Preferences;
  set(prefs: Preferences): void;
  /** At least one role is required; shows the error next to the roles otherwise. */
  validate(): boolean;
}

export function preferencesForm(root: HTMLElement): PreferencesForm {
  const inputs = (name: string) => all(`input[name="${name}"]`, HTMLInputElement, root);
  const checked = (name: string) =>
    inputs(name)
      .filter((input) => input.checked)
      .map((input) => input.value);
  const unspecified = required('input[name="include_unspecified"]', HTMLInputElement, root);
  const rolesError = required("[data-roles-error]", HTMLElement, root);
  const summary = (key: string) => required(`[data-summary="${key}"]`, HTMLElement, root);
  const pickers = all("[data-picker]", HTMLElement, root).map(setupPicker);

  const update = () => {
    for (const refresh of pickers) refresh();
    const sectors = checked("sectors").length;
    summary("sectors").textContent = sectors ? selectedText(sectors) : strings.allSectors;
    const places = checked("regions").length + checked("institutions").length;
    summary("location").textContent = places ? selectedText(places) : strings.allItaly;
    if (checked("roles").length) rolesError.hidden = true;
  };
  root.addEventListener("change", update);
  update();

  return {
    get: () => {
      const [locale] = checked("locale");
      return {
        locale: isLocale(locale) ? locale : "it",
        roles: checked("roles"),
        sectors: checked("sectors"),
        regions: checked("regions"),
        institutions: checked("institutions"),
        include_unspecified: unspecified.checked,
      };
    },
    set: (prefs) => {
      for (const list of LISTS) {
        const wanted = new Set(prefs[list]);
        for (const input of inputs(list)) input.checked = wanted.has(input.value);
      }
      for (const input of inputs("locale")) input.checked = input.value === prefs.locale;
      unspecified.checked = prefs.include_unspecified;
      update();
    },
    validate: () => {
      const ok = checked("roles").length > 0;
      rolesError.hidden = ok;
      if (!ok) inputs("roles")[0]?.focus();
      return ok;
    },
  };
}
