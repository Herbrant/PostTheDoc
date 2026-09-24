const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | undefined,
): Promise<boolean> {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const resp = await fetch(SITEVERIFY, { method: "POST", body: form });
  if (!resp.ok) return false;
  const body = await resp.json<{ success: boolean }>();
  return body.success === true;
}
