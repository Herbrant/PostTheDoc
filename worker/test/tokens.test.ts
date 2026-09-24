import { describe, expect, it, vi } from "vitest";
import { sign, verify } from "../src/tokens";

const SECRET = "test-secret";
const USER = "00000000-0000-4000-8000-000000000000";

// Test vector shared with tests/test_tokens.py: both sides must stay compatible.
const MANAGE_V3 =
  "bWFuYWdlLjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMC4zLjA" +
  ".Uz-jBzlVguii2gd0cwK5QASrYBTGnZA8YkRQXtnKEDk";

describe("tokens", () => {
  it("matches the Python implementation", async () => {
    expect(await sign(SECRET, "manage", USER, 3)).toBe(MANAGE_V3);
    expect(await verify(SECRET, MANAGE_V3, ["manage"])).toEqual({
      purpose: "manage",
      userId: USER,
      version: 3,
      exp: 0,
    });
  });

  it("rejects wrong purpose, secret and tampering", async () => {
    expect(await verify(SECRET, MANAGE_V3, ["unsubscribe"])).toBeNull();
    expect(await verify("other", MANAGE_V3, ["manage"])).toBeNull();
    const [payload, sig] = MANAGE_V3.split(".");
    expect(await verify(SECRET, `${payload}.${sig.slice(0, -2)}AA`, ["manage"])).toBeNull();
    expect(await verify(SECRET, "garbage", ["manage"])).toBeNull();
    expect(await verify(SECRET, "!!!.???", ["manage"])).toBeNull();
  });

  it("expires", async () => {
    const token = await sign(SECRET, "confirm", USER, 0, 60);
    expect(await verify(SECRET, token, ["confirm"])).not.toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(await verify(SECRET, token, ["confirm"])).toBeNull();
    vi.useRealTimers();
  });
});
