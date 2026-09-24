// Subscribe wizard: 1) email, 2) preferences + anti-bot check, 3) "check your inbox".
import { STORAGE_KEYS } from "../../config/storage-keys";
import { format } from "../../i18n/format";
import { readEmail, submitWithCaptcha } from "../forms/captcha-submit";
import { preferencesForm } from "../forms/preferences";
import { api } from "../lib/api";
import { all, required, submitButton } from "../lib/dom";
import { hideMessage } from "../lib/messages";
import { type Captcha, renderCaptcha } from "../lib/turnstile";

const emailForm = required("#step-email", HTMLFormElement);
const prefsForm = required("#step-prefs", HTMLFormElement);
const done = required("#step-done", HTMLElement);
const message = required("#message", HTMLElement);
const emailInput = required("[data-email]", HTMLInputElement, emailForm);
const prefs = preferencesForm(required("[data-prefs]", HTMLElement, prefsForm));
let captcha: Promise<Captcha> | undefined;

function goTo(step: 1 | 2 | 3) {
  emailForm.hidden = step !== 1;
  prefsForm.hidden = step !== 2;
  done.hidden = step !== 3;
  for (const item of all("[data-wizard-steps] li", HTMLElement)) {
    const n = Number(item.dataset.step);
    item.classList.toggle("done", n < step);
    if (n === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  }
  hideMessage(message);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showPreferences(email: string) {
  required("[data-email-recap]", HTMLElement).textContent = email;
  goTo(2);
  // Rendered once the container is visible, so the widget gets its real size.
  captcha ??= renderCaptcha(required("#turnstile-subscribe", HTMLElement));
}

emailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = readEmail(emailInput, message);
  if (!email) return;
  sessionStorage.setItem(STORAGE_KEYS.email, email);
  showPreferences(email);
});

required("[data-change-email]", HTMLButtonElement).addEventListener("click", () => {
  goTo(1);
  emailInput.focus();
});

prefsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage(message);
  if (!prefs.validate() || !captcha) return;
  const email = emailInput.value;
  const sent = await submitWithCaptcha({
    button: submitButton(prefsForm),
    captcha,
    message,
    send: (turnstileToken) => api.subscribe({ email, turnstileToken, ...prefs.get() }),
  });
  if (!sent) return;
  sessionStorage.removeItem(STORAGE_KEYS.email);
  const text = required("[data-done-text]", HTMLElement);
  text.textContent = format(text.dataset.template ?? "", { email });
  goTo(3);
});

// Email typed on the home page: go straight to the preferences.
const handedOver = sessionStorage.getItem(STORAGE_KEYS.email);
if (handedOver) {
  emailInput.value = handedOver;
  if (emailInput.checkValidity()) showPreferences(handedOver);
}
