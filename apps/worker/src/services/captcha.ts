/** Cloudflare Turnstile: the captcha of the subscribe and manage-link forms. */
import type { CaptchaAction } from "@postthedoc/shared/api";
import type { AppContext } from "../types";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Siteverify answers in well under a second: past this, the form is told to retry. */
const SITEVERIFY_TIMEOUT_MS = 10_000;

// Cloudflare's dummy secret keys: 1x… always passes, 2x… always fails, 3x… token already spent.
const TEST_SECRET = /^[123]x0+AA$/;

export const isTestSecret = (secret: string): boolean => TEST_SECRET.test(secret);

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
}

/** What the solved challenge must match; dummy keys report neither, so development checks none. */
export interface Expected {
  hostname: string;
  action: CaptchaAction;
}

/**
 * Check a Turnstile token: false if it is invalid, was solved elsewhere or for another form, or
 * if siteverify cannot be reached (the user is asked to retry, not shown an internal error).
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | undefined,
  expected?: Expected,
): Promise<boolean> {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  let body: SiteverifyResponse;
  try {
    const resp = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!resp.ok) return false;
    body = await resp.json();
  } catch (err) {
    console.error("Turnstile siteverify failed", err);
    return false;
  }
  if (body.success !== true) return false;
  return !expected || (body.hostname === expected.hostname && body.action === expected.action);
}

/** Whether the request passed the captcha of the `action` form, with the environment's policy. */
export async function passesCaptcha(
  c: AppContext,
  token: string,
  action: CaptchaAction,
): Promise<boolean> {
  const { ENVIRONMENT, TURNSTILE_SECRET, FRONTEND_URL } = c.env;
  const ip = c.req.header("CF-Connecting-IP");
  if (ENVIRONMENT === "development") return verifyTurnstile(TURNSTILE_SECRET, token, ip);
  if (isTestSecret(TURNSTILE_SECRET)) {
    // Fail closed: a dummy key left in production would let every bot through.
    console.error("TURNSTILE_SECRET is a Cloudflare test key: set the real one");
    return false;
  }
  const hostname = new URL(FRONTEND_URL).hostname;
  return verifyTurnstile(TURNSTILE_SECRET, token, ip, { hostname, action });
}
