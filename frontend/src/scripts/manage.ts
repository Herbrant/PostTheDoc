// Manage page: the token comes from the email link (#t=…); without a valid one, offer a new link.
import {
  api,
  busy,
  CAPTCHA_WAIT,
  captchaPendingMessage,
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

// The token of the email link is moved from the address bar (history, screenshots, shared tabs)
// to sessionStorage, so that it still survives a reload or a language switch.
const TOKEN_KEY = "postthedoc-manage-token";
const fromLink = new URLSearchParams(location.hash.slice(1)).get("t");
if (fromLink) {
  sessionStorage.setItem(TOKEN_KEY, fromLink);
  history.replaceState(null, "", location.pathname + location.search);
}
const token = sessionStorage.getItem(TOKEN_KEY) ?? "";
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

  // Everything stored about the user, as a JSON file (right of access and portability).
  document.getElementById("export")!.addEventListener("click", async (event) => {
    hideMessage(message);
    const resp = await busy(event.currentTarget as HTMLButtonElement, () =>
      api("/api/preferences/export", { headers: auth }),
    );
    if (!resp.ok) {
      showMessage(message, await errorText(resp), "error");
      return;
    }
    const url = URL.createObjectURL(await resp.blob());
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: "postthedoc-data.json",
    });
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("delete")!.addEventListener("click", async (event) => {
    if (!confirm(strings.confirmDelete)) return;
    const resp = await busy(event.currentTarget as HTMLButtonElement, () =>
      api("/api/preferences", { method: "DELETE", headers: auth }),
    );
    if (resp.ok) {
      form.hidden = true;
      sessionStorage.removeItem(TOKEN_KEY); // the token is no longer valid
      history.replaceState(null, "", location.pathname);
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
    const button = linkForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const turnstileToken = await busy(button, () => captcha.token(CAPTCHA_WAIT));
    if (!turnstileToken) {
      captchaPendingMessage(message, captcha);
      return;
    }
    const resp = await busy(button, () =>
      api("/api/manage-link", jsonInit("POST", { email: emailInput.value, turnstileToken })),
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
  if (resp.status === 401) sessionStorage.removeItem(TOKEN_KEY); // expired or revoked
  showMessage(message, await errorText(resp), "error");
  return initManageLink();
}

main();
