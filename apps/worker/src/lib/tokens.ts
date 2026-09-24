/**
 * Signed tokens for email links, in the same format as apps/pipeline/src/postthedoc/tokens.py:
 *
 *   base64url("{purpose}.{userId}.{version}.{exp}") + "." + base64url(HMAC-SHA256)
 *
 * exp is a Unix timestamp; 0 means the token never expires. No token is stored anywhere: bumping
 * the user's token_version invalidates every token issued before.
 */
import { TOKEN_PURPOSES, type TokenPurpose } from "@postthedoc/shared/contract";
import { nowSeconds } from "./time";

export interface TokenData {
  purpose: TokenPurpose;
  userId: string;
  version: number;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// Importing a key is not free: keep one per secret (in practice, a single one).
const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    keys.set(secret, key);
  }
  return key;
}

const isPurpose = (value: string): value is TokenPurpose =>
  (TOKEN_PURPOSES as readonly string[]).includes(value);

/** Sign a token; `ttlSeconds` 0 (the default) for a token that never expires. */
export async function sign(
  secret: string,
  purpose: TokenPurpose,
  userId: string,
  version: number,
  ttlSeconds = 0,
): Promise<string> {
  const exp = ttlSeconds ? nowSeconds() + ttlSeconds : 0;
  const payload = `${purpose}.${userId}.${version}.${exp}`;
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(new Uint8Array(mac))}`;
}

/** The token's data if it is authentic, unexpired and for one of `purposes`; null otherwise. */
export async function verify(
  secret: string,
  token: string,
  purposes: readonly TokenPurpose[],
): Promise<TokenData | null> {
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;

  let payload: string;
  try {
    const payloadBytes = fromBase64Url(encoded);
    const key = await hmacKey(secret);
    if (!(await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), payloadBytes))) {
      return null;
    }
    payload = decoder.decode(payloadBytes);
  } catch {
    return null; // invalid base64
  }

  const [purpose, userId, version, exp, ...extra] = payload.split(".");
  if (purpose === undefined || userId === undefined || extra.length > 0) return null;
  const data = { userId, version: Number(version), exp: Number(exp) };
  if (!isPurpose(purpose) || !purposes.includes(purpose)) return null;
  if (!Number.isInteger(data.version) || !Number.isInteger(data.exp)) return null;
  if (data.exp && data.exp < nowSeconds()) return null;
  return { purpose, ...data };
}
