// Subscribe wizard: 1) email, 2) preferences + anti-bot check, 3) "check your inbox".
import { format } from "../i18n/strings";
import {
  api,
  busy,
  type Captcha,
  errorText,
  hideMessage,
  jsonInit,
  showMessage,
  strings,
  turnstileWidget,
} from "./client";
import { preferencesForm } from "./preferences";
import { EMAIL_KEY } from "./subscribe-state";

const emailForm = document.getElementById("step-email") as HTMLFormElement;
const prefsForm = document.getElementById("step-prefs") as HTMLFormElement;
const done = document.getElementById("step-done") as HTMLElement;
const message = document.getElementById("message") as HTMLElement;
const emailInput = emailForm.querySelector<HTMLInputElement>('input[name="email"]')!;
const lang = emailForm.dataset.lang!;
const prefs = preferencesForm(prefsForm.querySelector<HTMLElement>("[data-prefs]")!);
let captcha: Promise<Captcha> | undefined;

function goTo(step: 1 | 2 | 3) {
  emailForm.hidden = step !== 1;
  prefsForm.hidden = step !== 2;
  done.hidden = step !== 3;
  for (const item of document.querySelectorAll<HTMLElement>("#wizard-steps li")) {
    const n = Number(item.dataset.step);
    item.classList.toggle("done", n < step);
    if (n === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  }
  hideMessage(message);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showPreferences() {
  document.getElementById("email-recap")!.textContent = emailInput.value;
  goTo(2);
  // Rendered once the container is visible, so the widget gets its real size.
  captcha ??= turnstileWidget(document.getElementById("turnstile")!, lang);
}

emailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  emailInput.value = emailInput.value.trim();
  if (!emailInput.checkValidity()) {
    showMessage(message, strings.errorEmailFormat, "error");
    emailInput.focus();
    return;
  }
  sessionStorage.setItem(EMAIL_KEY, emailInput.value);
  showPreferences();
});

document.getElementById("change-email")!.addEventListener("click", () => {
  goTo(1);
  emailInput.focus();
});

prefsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage(message);
  if (!prefs.validate()) return;
  const widget = await captcha!;
  if (!widget.token()) {
    showMessage(message, strings.errorCaptchaPending, "info");
    return;
  }
  const button = prefsForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const resp = await busy(button, () =>
    api(
      "/api/subscribe",
      jsonInit("POST", { email: emailInput.value, turnstileToken: widget.token(), ...prefs.get() }),
    ),
  );
  widget.reset();
  if (!resp.ok) {
    showMessage(message, await errorText(resp), "error");
    return;
  }
  sessionStorage.removeItem(EMAIL_KEY);
  const text = document.getElementById("done-text")!;
  text.textContent = format(text.dataset.template!, { email: emailInput.value });
  goTo(3);
});

// Email typed on the home page: go straight to the preferences.
const handedOver = sessionStorage.getItem(EMAIL_KEY);
if (handedOver) {
  emailInput.value = handedOver;
  if (emailInput.checkValidity()) showPreferences();
}
