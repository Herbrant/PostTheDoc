import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { hourIn } from "../src/lib/time";

const DISPATCH_URL =
  "https://api.github.com/repos/Herbrant/PostTheDoc/actions/workflows/daily.yml/dispatches";

let dispatches: { url: string; init: RequestInit | undefined }[];
let githubStatus: number;

beforeEach(() => {
  dispatches = [];
  githubStatus = 204;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://api.github.com/")) {
      dispatches.push({ url, init });
      return new Response(null, { status: githubStatus });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function fire(utc: string) {
  const controller = createScheduledController({ scheduledTime: new Date(utc), cron: "0 8 * * *" });
  return worker.scheduled(controller, env);
}

describe("daily job trigger", () => {
  it("dispatches the workflow at 10:00 summer time", async () => {
    await fire("2026-07-01T08:00:00Z");

    expect(dispatches).toHaveLength(1);
    const { url, init } = dispatches[0];
    expect(url).toBe(DISPATCH_URL);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ ref: "main" });
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${env.GITHUB_DISPATCH_TOKEN}`);
    expect(headers.get("user-agent")).toBeTruthy();
  });

  it("skips the other trigger in summer time", async () => {
    await fire("2026-07-01T09:00:00Z");
    expect(dispatches).toHaveLength(0);
  });

  it("dispatches at 10:00 winter time and skips the other trigger", async () => {
    await fire("2026-12-01T08:00:00Z");
    expect(dispatches).toHaveLength(0);

    await fire("2026-12-01T09:00:00Z");
    expect(dispatches).toHaveLength(1);
  });

  it.each([401, 500])("fails when GitHub answers %i", async (status) => {
    githubStatus = status;
    await expect(fire("2026-07-01T08:00:00Z")).rejects.toThrow(String(status));
  });
});

describe("hourIn", () => {
  it("follows the end of summer time in Italy", () => {
    // 25/10/2026: 03:00 CEST becomes 02:00 CET at 01:00 UTC.
    expect(hourIn("Europe/Rome", Date.parse("2026-10-25T00:59:00Z"))).toBe(2);
    expect(hourIn("Europe/Rome", Date.parse("2026-10-25T01:00:00Z"))).toBe(2);
    expect(hourIn("Europe/Rome", Date.parse("2026-10-25T08:00:00Z"))).toBe(9);
    expect(hourIn("Europe/Rome", Date.parse("2026-10-25T09:00:00Z"))).toBe(10);
  });

  it("reads midnight as 0", () => {
    expect(hourIn("Europe/Rome", Date.parse("2026-12-01T23:00:00Z"))).toBe(0);
  });
});
