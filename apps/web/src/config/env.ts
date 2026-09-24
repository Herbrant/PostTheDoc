/**
 * Build-time configuration from the PUBLIC_* variables (see .env.example). Development servers
 * fall back to local defaults; production builds fail instead of shipping a broken site.
 */

function setting(name: string, value: string | undefined, devDefault?: string): string {
  if (value) return value;
  if (import.meta.env.DEV && devDefault !== undefined) return devDefault;
  throw new Error(`Set ${name}: it is required by production builds (see .env.example)`);
}

/** The Worker, without a trailing slash. */
export const API_URL = setting(
  "PUBLIC_API_URL",
  import.meta.env.PUBLIC_API_URL,
  "http://localhost:8787",
).replace(/\/+$/, "");

/** Public Turnstile site key; in development, Cloudflare's test key (always passes). */
export const TURNSTILE_SITE_KEY = setting(
  "PUBLIC_TURNSTILE_SITE_KEY",
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
  "1x00000000000000000000AA",
);

/** Umami Cloud website ID: without it (local development, forks) no analytics script loads. */
export const UMAMI_WEBSITE_ID = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID || undefined;

/** The data controller named by the privacy notice: every deployment names its own. */
export const controller = () => ({
  name: setting("PUBLIC_CONTROLLER_NAME", import.meta.env.PUBLIC_CONTROLLER_NAME, "…"),
  email: setting("PUBLIC_CONTROLLER_EMAIL", import.meta.env.PUBLIC_CONTROLLER_EMAIL, ""),
});
