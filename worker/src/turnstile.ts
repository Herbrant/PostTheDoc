const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare's dummy secret keys (1x… always passes, 2x… always fails, 3x… token already spent).
const TEST_SECRET = /^[123]x0+AA$/;

export const isTestSecret = (secret: string) => TEST_SECRET.test(secret);

/**
 * Check a Turnstile token. `hostname`, when given, must be the site where the challenge was solved
 * (dummy keys report "example.com", so local development passes none).
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
  const resp = await fetch(SITEVERIFY, { method: "POST", body: form });
  if (!resp.ok) return false;
  const body = await resp.json<{ success: boolean; hostname?: string }>();
  return body.success === true && (hostname === undefined || body.hostname === hostname);
}
