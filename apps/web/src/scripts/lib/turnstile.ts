/** Cloudflare Turnstile, the anti-bot check of the forms (components/forms/Captcha.astro). */
import { TURNSTILE_SITE_KEY } from "../../config/env";
import { required } from "./dom";

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Error code reported when the Turnstile script never loaded (e.g. a content blocker). */
export const UNAVAILABLE = "unavailable";

/** How long to wait for the Turnstile script (ms). */
const LOAD_TIMEOUT = 15_000;
/** How long a submit waits for a check still in progress (ms). */
export const TOKEN_TIMEOUT = 10_000;

export interface Captcha {
  /** The card around the widget. */
  element: HTMLElement;
  /** The token, waiting up to `timeout` ms for a check still in progress; "" if none. */
  token(timeout?: number): Promise<string>;
  /** Code of the last Turnstile error, "" if none. */
  error(): string;
  reset(): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The Turnstile API once its script (loaded by the layout) is ready; null after a timeout. */
async function loadTurnstile(): Promise<TurnstileApi | null> {
  // Check render, not just window.turnstile: an element with id="turnstile" is exposed there too.
  for (const end = Date.now() + LOAD_TIMEOUT; Date.now() < end; await sleep(50)) {
    if (typeof window.turnstile?.render === "function") return window.turnstile;
  }
  return null;
}

/** A captcha that never passes, for when Turnstile could not load. */
const unavailable = (element: HTMLElement): Captcha => ({
  element,
  token: async () => "",
  error: () => UNAVAILABLE,
  reset: () => {},
});

/**
 * Render the widget in a Captcha card. The card stays collapsed unless Cloudflare asks the user
 * to interact.
 */
export async function renderCaptcha(container: HTMLElement): Promise<Captcha> {
  const turnstile = await loadTurnstile();
  if (!turnstile) return unavailable(container);

  let token = "";
  let error = "";
  const id = turnstile.render(required("[data-captcha-slot]", HTMLElement, container), {
    sitekey: TURNSTILE_SITE_KEY,
    action: container.dataset.action,
    language: document.documentElement.lang,
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    size: "flexible",
    appearance: "interaction-only",
    // Stays open afterwards, so the user sees the check succeed.
    "before-interactive-callback": () => container.classList.add("is-visible"),
    callback: (value: string) => {
      token = value;
      error = "";
    },
    "expired-callback": () => {
      token = "";
    },
    "error-callback": (code: string) => {
      console.warn("Turnstile error", code);
      error = code || "unknown";
      return true; // handled: Turnstile retries on its own
    },
  });
  return {
    element: container,
    token: async (timeout = 0) => {
      for (const end = Date.now() + timeout; !token && !error && Date.now() < end; ) {
        await sleep(100);
      }
      return token;
    },
    error: () => error,
    reset: () => {
      token = "";
      error = "";
      container.classList.remove("is-visible");
      turnstile.reset(id);
    },
  };
}
