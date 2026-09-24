import { afterEach, describe, expect, it, vi } from "vitest";
import vectors from "../../../packages/shared/fixtures/tokens.json";
import { sign, verify } from "../src/lib/tokens";

const USER = "00000000-0000-4000-8000-000000000000";
const { secret } = vectors;

afterEach(() => {
  vi.useRealTimers();
});

describe("tokens", () => {
  it.each(vectors.vectors)("matches the shared vector for $purpose", async (vector) => {
    const purpose = vector.purpose as "manage";
    expect(await sign(secret, purpose, vector.userId, vector.version)).toBe(vector.token);
    expect(await verify(secret, vector.token, [purpose])).toEqual({
      purpose,
      userId: vector.userId,
      version: vector.version,
      exp: vector.exp,
    });
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
