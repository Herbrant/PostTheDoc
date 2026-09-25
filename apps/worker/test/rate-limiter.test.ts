import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const limiter = (name: string) => env.RATE_LIMITER.getByName(name);

describe("RateLimiter", () => {
  it("refuses requests past the limit of the window", async () => {
    const stub = limiter("email:203.0.113.1");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await stub.hit(3, 60));
    expect(results).toEqual([true, true, true, false]);
    // Other clients have limits of their own.
    expect(await limiter("email:203.0.113.2").hit(3, 60)).toBe(true);
  });

  it("stops counting past the limit, so that a flood writes nothing", async () => {
    const stub = limiter("email:203.0.113.3");
    for (let i = 0; i < 3; i++) await stub.hit(1, 60);
    expect(await runInDurableObject(stub, (_, state) => state.storage.get("window"))).toEqual({
      end: expect.any(Number),
      count: 1,
    });
  });

  it("starts over, leaving nothing behind, once the window is over", async () => {
    const stub = limiter("api:2001:db8:1:2::/64");
    await stub.hit(1, 60);
    expect(await stub.hit(1, 60)).toBe(false);

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await runInDurableObject(stub, (_, state) => state.storage.list())).toEqual(new Map());
    expect(await stub.hit(1, 60)).toBe(true);
  });

  it("starts a new window when the last one has expired", async () => {
    const stub = limiter("api:203.0.113.4");
    await runInDurableObject(stub, (_, state) =>
      state.storage.put("window", { end: Date.now() - 1, count: 30 }),
    );
    expect(await stub.hit(30, 60)).toBe(true);
  });
});
