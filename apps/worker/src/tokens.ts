// Signed tokens for email links. Same format as src/postthedoc/tokens.py:
// base64url("{purpose}.{userId}.{version}.{exp}") + "." + base64url(HMAC-SHA256), exp = 0 never expires.

export type Purpose = "confirm" | "manage" | "unsubscribe";

export interface TokenData {
  purpose: Purpose;
  userId: string;
  version: number;
  exp: number;
}

const encoder = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sign(
  secret: string,
  purpose: Purpose,
  userId: string,
  version: number,
  ttlSeconds?: number,
): Promise<string> {
  const exp = ttlSeconds ? Math.floor(Date.now() / 1000) + ttlSeconds : 0;
  const payload = `${purpose}.${userId}.${version}.${exp}`;
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${toB64url(encoder.encode(payload))}.${toB64url(new Uint8Array(mac))}`;
}

export async function verify(
  secret: string,
  token: string,
  purposes: Purpose[],
): Promise<TokenData | null> {
  try {
    const [encoded, signature, ...rest] = token.split(".");
    if (!encoded || !signature || rest.length) return null;
    const payloadBytes = fromB64url(encoded);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromB64url(signature),
      payloadBytes,
    );
    if (!valid) return null;

    const [purpose, userId, version, exp, ...extra] = new TextDecoder()
      .decode(payloadBytes)
      .split(".");
    if (userId === undefined || version === undefined || exp === undefined || extra.length > 0) {
      return null;
    }
    const data: TokenData = {
      purpose: purpose as Purpose,
      userId,
      version: Number(version),
      exp: Number(exp),
    };
    if (!purposes.includes(data.purpose) || !Number.isInteger(data.version)) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null; // invalid base64
  }
}
