/** Behavior of components/forms/Picker.astro: search, "select all", selection chips. */
import { format } from "../../i18n/format";
import { all, required } from "../lib/dom";
import { strings } from "../lib/strings";

/** Changes made by script do not fire events: notify the form so that its summaries follow. */
export const notifyChange = (input: HTMLInputElement) =>
  input.dispatchEvent(new Event("change", { bubbles: true }));

interface Item {
  label: HTMLLabelElement;
  input: HTMLInputElement;
  text: string;
  search: string;
}

interface Group {
  element: HTMLElement;
  details: HTMLDetailsElement;
  toggle: HTMLInputElement;
  count: HTMLElement;
  name: string;
  items: Item[];
}

function readGroup(element: HTMLElement): Group {
  return {
    element,
    details: required("details", HTMLDetailsElement, element),
    toggle: required("[data-picker-toggle]", HTMLInputElement, element),
    count: required("[data-count]", HTMLElement, element),
    name: element.dataset.groupName ?? "",
    items: all("[data-picker-item]", HTMLLabelElement, element).map((label) => ({
      label,
      input: required("input", HTMLInputElement, label),
      text: label.textContent?.trim() ?? "",
      search: label.dataset.search ?? "",
    })),
  };
}

function chip(text: string, inputs: HTMLInputElement[]): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "picker-chip";
  const label = document.createElement("span");
  label.textContent = label.title = text;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", format(strings.remove, { label: text }));
  remove.addEventListener("click", () => {
    for (const input of inputs) input.checked = false;
    if (inputs[0]) notifyChange(inputs[0]);
  });
  item.append(label, remove);
  return item;
}

/** Wire up a picker; returns the function that redraws its counts and chips. */
export function setupPicker(picker: HTMLElement): () => void {
  const search = required("[data-picker-search]", HTMLInputElement, picker);
  const chips = required("[data-picker-chips]", HTMLElement, picker);
  const chipList = required("[data-chip-list]", HTMLElement, chips);
  const empty = required("[data-picker-empty]", HTMLElement, picker);
  const groups = all("[data-picker-group]", HTMLElement, picker).map(readGroup);
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
        return [
          chip(
            `${group.name} (${items.length})`,
            items.map((i) => i.input),
          ),
        ];
      }
      return items.map((item) => chip(item.text, [item.input]));
    });
    chipList.replaceChildren(...selected);
    chips.hidden = selected.length === 0;
  };

  // Select all acts on the visible items only, so that it follows the search. The toggle's own
  // change event then bubbles up to the form, which redraws everything.
  for (const group of groups) {
    group.toggle.addEventListener("change", () => {
      for (const item of group.items) {
        if (!item.label.hidden) item.input.checked = group.toggle.checked;
      }
    });
  }

  // Like the per-group toggles, the whole-list "select all" follows the search.
  picker.querySelector("[data-picker-select-all]")?.addEventListener("click", () => {
    for (const item of allItems) {
      if (!item.label.hidden) item.input.checked = true;
    }
    notifyChange(search);
  });

  required("[data-picker-clear]", HTMLButtonElement, chips).addEventListener("click", () => {
    for (const item of allItems) item.input.checked = false;
    notifyChange(search);
  });

  // While searching, the groups with a match are open; clearing the search restores them.
  let searching = false;
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    if (query && !searching) {
      for (const group of groups) group.details.dataset.wasOpen = String(group.details.open);
    }
    let matches = 0;
    for (const group of groups) {
      let visible = 0;
      for (const item of group.items) {
        item.label.hidden = query !== "" && !item.search.includes(query);
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
