// Home page: hand the email over to the subscribe wizard, which opens on the preferences step.
import { STORAGE_KEYS } from "../../config/storage-keys";
import { required } from "../lib/dom";
import { session } from "../lib/storage";

const form = required("[data-quick-subscribe]", HTMLFormElement);
const input = required("[data-email]", HTMLInputElement, form);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  session.set(STORAGE_KEYS.email, input.value.trim());
  location.href = form.action;
});
