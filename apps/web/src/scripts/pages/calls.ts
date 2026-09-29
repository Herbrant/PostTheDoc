// Open calls page: filters by role, region and scientific area, and the time left to apply.
// The page is built once a day: calls that closed since are hidden here.
import { format } from "../../i18n/format";
import { daysLeft } from "../lib/deadline";
import { all, required } from "../lib/dom";
import { strings } from "../lib/strings";

// Deadlines this close are highlighted.
const SOON_DAYS = 3;

const form = required("[data-calls-filters]", HTMLFormElement);
const roleButtons = all("[data-role-filter]", HTMLButtonElement, form);
const region = required("[data-region-filter]", HTMLSelectElement, form);
const area = required("[data-area-filter]", HTMLSelectElement, form);
const count = required("[data-calls-count]", HTMLElement, form);
const empty = required("[data-calls-empty]", HTMLElement);
const months = all("[data-month]", HTMLElement);
const now = new Date();

/** Calls still open, with their relative deadline shown. */
function openCards(): HTMLElement[] {
  const open: HTMLElement[] = [];
  for (const card of all("[data-call]", HTMLElement)) {
    const deadline = card.dataset.deadline ? new Date(card.dataset.deadline) : null;
    const days = deadline ? daysLeft(deadline, now) : null;
    if (deadline && deadline < now) {
      card.remove();
      continue;
    }
    const due = required("[data-due]", HTMLElement, card);
    if (days !== null && days <= 7) {
      due.textContent =
        days === 0
          ? strings.dueToday
          : days === 1
            ? strings.dueTomorrow
            : format(strings.dueIn, { n: days });
      due.classList.toggle("is-soon", days <= SOON_DAYS);
      due.hidden = false;
    }
    open.push(card);
  }
  return open;
}

const cards = openCards();

function apply() {
  const roles = new Set(
    roleButtons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.value),
  );
  let shown = 0;
  for (const card of cards) {
    const { role = "", region: callRegion = "", areas = "" } = card.dataset;
    card.hidden = !(
      (roles.size === 0 || roles.has(role)) &&
      (!region.value || callRegion === region.value) &&
      (!area.value || areas.split(" ").includes(area.value))
    );
    if (!card.hidden) shown++;
  }
  for (const month of months) {
    const visible = all("[data-call]:not([hidden])", HTMLElement, month).length;
    month.hidden = visible === 0;
    required("[data-month-count]", HTMLElement, month).textContent = String(visible);
  }
  count.textContent = shown === 1 ? strings.callsOne : format(strings.calls, { n: shown });
  empty.hidden = shown > 0;
}

for (const button of roleButtons) {
  button.addEventListener("click", () => {
    const pressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!pressed));
    apply();
  });
}
form.addEventListener("change", apply);
form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("reset", () => {
  for (const button of roleButtons) button.setAttribute("aria-pressed", "false");
  // The selects are reset after this event.
  setTimeout(apply);
});
required("[data-calls-reset-empty]", HTMLButtonElement).addEventListener("click", () =>
  form.reset(),
);

form.hidden = false;
apply();
