// Manage page: the token comes from the email link (#t=…); without a valid one, offer a new link.
import {
  api,
  busy,
  errorText,
  hideMessage,
  jsonInit,
  showMessage,
  strings,
  turnstileWidget,
} from "./client";
import { type Preferences, preferencesForm } from "./preferences";

const form = document.getElementById("manage") as HTMLFormElement;
const linkForm = document.getElementById("manage-link") as HTMLFormElement;
const message = document.getElementById("message") as HTMLElement;
const lang = form.dataset.lang!;
const token = new URLSearchParams(location.hash.slice(1)).get("t") ?? "";
const auth = { Authorization: `Bearer ${token}` };

async function initManage(current: Preferences & { email: string }) {
  document.getElementById("email")!.textContent = current.email;
  const prefs = preferencesForm(form.querySelector<HTMLElement>("[data-prefs]")!);
  prefs.set(current);
  form.hidden = false;
  if (new URLSearchParams(location.search).has("welcome")) {
    showMessage(message, strings.welcome, "success");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage(message);
    if (!prefs.validate()) return;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const resp = await busy(button, () =>
      api("/api/preferences", jsonInit("PUT", prefs.get(), auth)),
    );
    if (resp.ok) showMessage(message, strings.saved, "success");
    else showMessage(message, await errorText(resp), "error");
  });

  document.getElementById("delete")!.addEventListener("click", async (event) => {
    if (!confirm(strings.confirmDelete)) return;
    const resp = await busy(event.currentTarget as HTMLButtonElement, () =>
      api("/api/preferences", { method: "DELETE", headers: auth }),
    );
    if (resp.ok) {
      form.hidden = true;
      history.replaceState(null, "", location.pathname); // the token is no longer valid
      showMessage(message, strings.deleted, "success");
    } else {
      showMessage(message, await errorText(resp), "error");
    }
  });
}

async function initManageLink() {
  linkForm.hidden = false;
  const captcha = await turnstileWidget(document.getElementById("turnstile-link")!, lang);
  const emailInput = linkForm.querySelector<HTMLInputElement>('input[name="email"]')!;

  linkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    emailInput.value = emailInput.value.trim();
    if (!emailInput.checkValidity()) {
      showMessage(message, strings.errorEmailFormat, "error");
      return;
    }
    if (!captcha.token()) {
      showMessage(message, strings.errorCaptchaPending, "info");
      return;
    }
    const button = linkForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const resp = await busy(button, () =>
      api(
        "/api/manage-link",
        jsonInit("POST", { email: emailInput.value, turnstileToken: captcha.token() }),
      ),
    );
    captcha.reset();
    if (resp.ok) {
      linkForm.hidden = true;
      showMessage(message, strings.linkSent, "success");
    } else {
      showMessage(message, await errorText(resp), "error");
    }
  });
}

// No top-level await: it is not supported by every browser Vite targets.
async function main() {
  if (!token) return initManageLink();
  const resp = await api("/api/preferences", { headers: auth });
  if (resp.ok) return initManage(await resp.json());
  showMessage(message, await errorText(resp), "error");
  return initManageLink();
}

main();
