// Behavior of components/PreferencesForm.astro: pickers, summaries, reading and writing values.
import { format, type Locale } from "../i18n/strings";
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

/** Changes made by script do not fire events: notify the form so that its summaries follow. */
const notify = (input: HTMLInputElement) =>
  input.dispatchEvent(new Event("change", { bubbles: true }));

/** Wire up a components/Picker.astro; returns the function that redraws counts and chips. */
function setupPicker(picker: HTMLElement): () => void {
  const search = picker.querySelector<HTMLInputElement>(".picker-search")!;
  const chips = picker.querySelector<HTMLElement>("[data-picker-chips]")!;
  const chipList = chips.querySelector<HTMLElement>("[data-chip-list]")!;
  const empty = picker.querySelector<HTMLElement>(".picker-empty")!;
  const groups = [...picker.querySelectorAll<HTMLElement>(".picker-group")].map((element) => ({
    element,
    details: element.querySelector("details")!,
    toggle: element.querySelector<HTMLInputElement>(".picker-group-toggle")!,
    count: element.querySelector<HTMLElement>("[data-count]")!,
    name: [".picker-group-code", ".picker-group-title"]
      .map((selector) => element.querySelector(selector)?.textContent)
      .filter(Boolean)
      .join(" "),
    items: [...element.querySelectorAll<HTMLElement>(".picker-item")].map((label) => ({
      label,
      input: label.querySelector("input")!,
      text: label.textContent!.trim(),
    })),
  }));
  const allItems = groups.flatMap((group) => group.items);

  const refresh = () => {
    for (const group of groups) {
      const n = group.items.filter((item) => item.input.checked).length;
      group.count.textContent = `${n}/${group.items.length}`;
      group.toggle.checked = n === group.items.length;
      group.toggle.indeterminate = n > 0 && n < group.items.length;
      group.element.classList.toggle("has-selection", n > 0);
    }
    // A fully selected group becomes a single chip, not one per item.
    const selected = groups.flatMap((group) => {
      const items = group.items.filter((item) => item.input.checked);
      if (items.length > 1 && items.length === group.items.length) {
        return [{ text: `${group.name} (${items.length})`, inputs: items.map((i) => i.input) }];
      }
      return items.map((item) => ({ text: item.text, inputs: [item.input] }));
    });
    chipList.replaceChildren(
      ...selected.map(({ text, inputs }) => {
        const chip = document.createElement("li");
        chip.className = "picker-chip";
        const label = document.createElement("span");
        label.textContent = label.title = text;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", format(strings.remove, { label: text }));
        remove.addEventListener("click", () => {
          for (const input of inputs) input.checked = false;
          notify(inputs[0]);
        });
        chip.append(label, remove);
        return chip;
      }),
    );
    chips.hidden = selected.length === 0;
  };

  // Select all acts on the visible items only, so that it follows the search. The toggle's own
  // change event then bubbles up to the form, which redraws everything.
  for (const group of groups) {
    group.toggle.addEventListener("change", () => {
      for (const item of group.items) if (!item.label.hidden) item.input.checked = group.toggle.checked;
    });
  }

  chips.querySelector("[data-picker-clear]")!.addEventListener("click", () => {
    for (const item of allItems) item.input.checked = false;
    notify(search);
  });

  // While searching, the groups with a match are open; clearing the search restores them.
  let searching = false;
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    if (query && !searching) for (const g of groups) g.details.dataset.wasOpen = String(g.details.open);
    let matches = 0;
    for (const group of groups) {
      let visible = 0;
      for (const item of group.items) {
        item.label.hidden = query !== "" && !item.label.dataset.search!.includes(query);
        if (!item.label.hidden) visible++;
      }
      group.element.hidden = visible === 0;
      group.details.open = query ? visible > 0 : group.details.dataset.wasOpen === "true";
      matches += visible;
    }
    searching = query !== "";
    empty.hidden = matches > 0;
  });
  // Enter in the search box must not submit the form.
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });

  return refresh;
}

export function preferencesForm(root: HTMLElement) {
  const inputs = (name: string) => [
    ...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
  ];
  const checked = (name: string) => inputs(name).filter((i) => i.checked).map((i) => i.value);
  const unspecified = inputs("include_unspecified")[0];
  const rolesError = root.querySelector<HTMLElement>("[data-roles-error]")!;
  const summary = (key: string) => root.querySelector<HTMLElement>(`[data-summary="${key}"]`)!;

  const pickers = [...root.querySelectorAll<HTMLElement>("[data-picker]")].map(setupPicker);

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
