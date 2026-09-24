import type { Locale } from "../i18n/strings";

// BASE_URL is "/PostTheDoc/" on GitHub Pages and "/" with a custom domain.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Path of a site file, e.g. asset("favicon.svg"). */
export const asset = (path: string) => `${BASE}/${path}`;

/** Path of a page, e.g. href("it", "subscribe/"). */
export const href = (lang: Locale, page = "") => `${BASE}/${lang}/${page}`;

export const REPO_URL = "https://github.com/Herbrant/PostTheDoc";
// Donation pages, linked from the footer and the home page (no third-party widget or script).
export const SPONSORS_URL = "https://github.com/sponsors/Herbrant";
export const COFFEE_URL = "https://buymeacoffee.com/PostTheDoc";

/** Worker URL, e.g. apiUrl("/api/subscribe"). */
export const apiUrl = (path: string) =>
  `${(import.meta.env.PUBLIC_API_URL || "http://localhost:8787").replace(/\/+$/, "")}${path}`;

/** Public Turnstile site key; defaults to Cloudflare's test key (always passes). */
export const TURNSTILE_SITE_KEY =
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
