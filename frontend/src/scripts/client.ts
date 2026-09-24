// Helpers shared by the browser scripts: strings, API calls, messages, Turnstile.
import { type ClientStrings, format } from "../i18n/strings";
import { apiUrl, TURNSTILE_SITE_KEY } from "../lib/urls";

export const strings: ClientStrings = JSON.parse(
  document.getElementById("client-strings")?.textContent ?? "{}",
);

export const selectedText = (n: number) =>
  n === 1 ? strings.selectedOne : format(strings.selectedMany, { n });

/** Call the Worker; network failures become a synthetic response with error "network". */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(apiUrl(path), init);
  } catch {
    return Response.json({ error: "network" }, { status: 599 });
  }
}

export const jsonInit = (method: string, body: unknown, headers: HeadersInit = {}): RequestInit => ({
  method,
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const ERRORS: Record<string, keyof ClientStrings> = {
  invalid: "errorInvalid",
  captcha: "errorCaptcha",
  email: "errorEmail",
  unauthorized: "errorUnauthorized",
  network: "errorNetwork",
};

/** Localized text for an error response of the Worker. */
export async function errorText(resp: Response): Promise<string> {
  const body = await resp.json().catch(() => ({}));
  const issue = body.issues?.[0];
  if (issue) return `${strings.errorInvalid} (${issue.path.join(".")}: ${issue.message})`;
  const key = ERRORS[body.error];
  return key ? strings[key] : format(strings.errorUnexpected, { status: resp.status });
}

export function showMessage(node: HTMLElement, text: string, kind: "success" | "error" | "info") {
  node.textContent = text;
  node.className = `message ${kind}`;
  node.hidden = false;
  node.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function hideMessage(node: HTMLElement) {
  node.hidden = true;
}

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface Captcha {
  token(): string;
  reset(): void;
}

/** Render the Turnstile widget (the script is loaded by the layout with `turnstile`). */
export async function turnstileWidget(container: HTMLElement, lang: string): Promise<Captcha> {
  // Check render, not just window.turnstile: an element with id="turnstile" is exposed there too.
  while (typeof window.turnstile?.render !== "function") {
    await new Promise((r) => setTimeout(r, 50));
  }
  const turnstile = window.turnstile;
  let token = "";
  const id = turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    language: lang,
    callback: (value: string) => (token = value),
    "expired-callback": () => (token = ""),
  });
  return {
    token: () => token,
    reset: () => {
      token = "";
      turnstile.reset(id);
    },
  };
}

/** Disable a button while `task` runs. */
export async function busy<T>(button: HTMLButtonElement, task: () => Promise<T>): Promise<T> {
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
