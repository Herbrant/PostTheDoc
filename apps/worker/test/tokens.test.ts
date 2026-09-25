import type { TokenPurpose } from "@postthedoc/shared/contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import vectors from "../../../packages/shared/fixtures/tokens.json";
import { sign, verify, verifyLink } from "../src/lib/tokens";

const USER = "00000000-0000-4000-8000-000000000000";
const { secret } = vectors;

afterEach(() => {
  vi.useRealTimers();
});

describe("tokens", () => {
  it.each(vectors.vectors)("matches the shared vector for $purpose", async (vector) => {
    const purpose = vector.purpose as TokenPurpose;
    if (vector.exp === 0) {
      expect(await sign(secret, purpose, vector.userId, vector.version)).toBe(vector.token);
    }
    expect(await verify(secret, vector.token, [purpose])).toEqual({
      purpose,
      userId: vector.userId,
      version: vector.version,
      exp: vector.exp,
    });
  });

  it.each(vectors.invalid)("rejects the shared invalid token: $reason", async (vector) => {
    expect(await verify(secret, vector.token, vector.purposes as TokenPurpose[])).toBeNull();
  });

  it("verifies only unsubscribe links with the previous secret", async () => {
    const secrets = { TOKEN_SECRET: "new", TOKEN_SECRET_PREVIOUS: secret };
    const unsubscribe = await sign(secret, "unsubscribe", USER, 0);
    expect(await verifyLink(secrets, unsubscribe, ["unsubscribe"])).not.toBeNull();
    const manage = await sign(secret, "manage", USER, 0);
    expect(await verifyLink(secrets, manage, ["manage"])).toBeNull();
    expect(await verifyLink(secrets, manage, ["manage", "unsubscribe"])).toBeNull();
    expect(await verifyLink({ TOKEN_SECRET: "new" }, unsubscribe, ["unsubscribe"])).toBeNull();
    const current = await sign("new", "manage", USER, 0);
    expect(await verifyLink(secrets, current, ["manage"])).not.toBeNull();
  });

  it("rejects wrong purpose, secret and tampering", async () => {
    const token = await sign(secret, "manage", USER, 3);
    expect(await verify(secret, token, ["unsubscribe"])).toBeNull();
    expect(await verify("other", token, ["manage"])).toBeNull();
    const [payload, signature] = token.split(".");
    expect(await verify(secret, `${payload}.${signature.slice(0, -2)}AA`, ["manage"])).toBeNull();
    expect(await verify(secret, "garbage", ["manage"])).toBeNull();
    expect(await verify(secret, "!!!.???", ["manage"])).toBeNull();
    expect(await verify(secret, `${token}.extra`, ["manage"])).toBeNull();
  });

  it("expires", async () => {
    const token = await sign(secret, "confirm", USER, 0, 60);
    expect(await verify(secret, token, ["confirm"])).not.toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(await verify(secret, token, ["confirm"])).toBeNull();
  });
});
