/** Cloudflare Turnstile: the captcha of the subscribe and manage-link forms. */
import type { AppContext } from "../types";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare's dummy secret keys: 1x… always passes, 2x… always fails, 3x… token already spent.
const TEST_SECRET = /^[123]x0+AA$/;

export const isTestSecret = (secret: string): boolean => TEST_SECRET.test(secret);

interface SiteverifyResponse {
  success: boolean;
  hostname?: string;
}

/**
 * Check a Turnstile token. `hostname`, when given, must be the site where the challenge was
 * solved (dummy keys report "example.com", so development passes none).
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | undefined,
  hostname?: string,
): Promise<boolean> {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const resp = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
  if (!resp.ok) return false;
  const body: SiteverifyResponse = await resp.json();
  return body.success === true && (hostname === undefined || body.hostname === hostname);
}

/** Whether the request passed the captcha, with the policy of the current environment. */
export async function passesCaptcha(c: AppContext, token: string): Promise<boolean> {
  const { ENVIRONMENT, TURNSTILE_SECRET, FRONTEND_URL } = c.env;
  const ip = c.req.header("CF-Connecting-IP");
  if (ENVIRONMENT === "development") return verifyTurnstile(TURNSTILE_SECRET, token, ip);
  if (isTestSecret(TURNSTILE_SECRET)) {
    // Fail closed: a dummy key left in production would let every bot through.
    console.error("TURNSTILE_SECRET is a Cloudflare test key: set the real one");
    return false;
  }
  return verifyTurnstile(TURNSTILE_SECRET, token, ip, new URL(FRONTEND_URL).hostname);
}
