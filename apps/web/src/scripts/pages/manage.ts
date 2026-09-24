// Manage page: the token comes from the email link (#t=…); without a valid one, offer a new link.
import type { PreferencesResponse } from "@postthedoc/shared/api";
import { LINK_PARAMS } from "@postthedoc/shared/contract";
import { STORAGE_KEYS } from "../../config/storage-keys";
import { readEmail, submitWithCaptcha } from "../forms/captcha-submit";
import { preferencesForm } from "../forms/preferences";
import { api } from "../lib/api";
import { busy } from "../lib/busy";
import { required, submitButton } from "../lib/dom";
import { hideMessage, showFailure, showMessage } from "../lib/messages";
import { strings } from "../lib/strings";
import { type Captcha, renderCaptcha } from "../lib/turnstile";

const form = required("#manage", HTMLFormElement);
const linkForm = required("#manage-link", HTMLFormElement);
const message = required("#message", HTMLElement);

// Until the scripts are ready, submitting must do nothing: a native submission would put the
// form's values in the URL.
for (const target of [form, linkForm]) {
  target.addEventListener("submit", (event) => event.preventDefault());
}

/**
 * The token of the email link, moved from the address bar (history, screenshots, shared tabs) to
 * sessionStorage, so that it still survives a reload or a language switch.
 */
function takeToken(): string {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get(LINK_PARAMS.token);
  if (fromLink) {
    sessionStorage.setItem(STORAGE_KEYS.manageToken, fromLink);
    history.replaceState(null, "", location.pathname + location.search);
  }
  return sessionStorage.getItem(STORAGE_KEYS.manageToken) ?? "";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

function showManage(token: string, current: PreferencesResponse) {
  required("[data-user-email]", HTMLElement).textContent = current.email;
  const prefs = preferencesForm(required("[data-prefs]", HTMLElement, form));
  prefs.set(current);
  form.hidden = false;
  if (new URLSearchParams(location.search).has(LINK_PARAMS.welcome)) {
    showMessage(message, strings.welcome, "success");
  }

  form.addEventListener("submit", async () => {
    hideMessage(message);
    if (!prefs.validate()) return;
    const result = await busy(submitButton(form), () => api.savePreferences(token, prefs.get()));
    if (result.ok) showMessage(message, strings.saved, "success");
    else showFailure(message, result);
  });

  // Everything stored about the user, as a JSON file (right of access and portability).
  const exportButton = required("[data-export]", HTMLButtonElement, form);
  exportButton.addEventListener("click", async () => {
    hideMessage(message);
    const result = await busy(exportButton, () => api.exportData(token));
    if (result.ok) download(result.data, "postthedoc-data.json");
    else showFailure(message, result);
  });

  const deleteButton = required("[data-delete]", HTMLButtonElement, form);
  deleteButton.addEventListener("click", async () => {
    if (!confirm(strings.confirmDelete)) return;
    const result = await busy(deleteButton, () => api.deleteSubscription(token));
    if (!result.ok) {
      showFailure(message, result);
      return;
    }
    form.hidden = true;
    sessionStorage.removeItem(STORAGE_KEYS.manageToken); // the token is no longer valid
    history.replaceState(null, "", location.pathname);
    showMessage(message, strings.deleted, "success");
  });
}

function showManageLinkForm() {
  linkForm.hidden = false;
  const captcha: Promise<Captcha> = renderCaptcha(required("#turnstile-link", HTMLElement));
  const emailInput = required("[data-email]", HTMLInputElement, linkForm);

  linkForm.addEventListener("submit", async () => {
    hideMessage(message);
    const email = readEmail(emailInput, message);
    if (!email) return;
    const sent = await submitWithCaptcha({
      button: submitButton(linkForm),
      captcha,
      message,
      send: (turnstileToken) => api.requestManageLink({ email, turnstileToken }),
    });
    if (sent) {
      linkForm.hidden = true;
      showMessage(message, strings.linkSent, "success");
    }
  });
}

// No top-level await: it is not supported by every browser Vite targets.
async function main() {
  const token = takeToken();
  if (!token) {
    showManageLinkForm();
    return;
  }
  const result = await api.getPreferences(token);
  if (result.ok) {
    showManage(token, result.data);
    return;
  }
  if (result.error === "unauthorized") sessionStorage.removeItem(STORAGE_KEYS.manageToken);
  showFailure(message, result);
  showManageLinkForm();
}

main();
