import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { hourIn } from "../src/lib/time";

const DISPATCH_URL =
  "https://api.github.com/repos/Herbrant/PostTheDoc/actions/workflows/daily.yml/dispatches";

let dispatches: { url: string; init: RequestInit | undefined }[];
let githubStatus: number;
let runs: { conclusion: string | null }[];
let runsStatus: number;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM users"); // deliveries and call_updates go with them
  dispatches = [];
  githubStatus = 204;
  runs = [{ conclusion: "failure" }];
  runsStatus = 200;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/runs?")) {
      return Response.json({ workflow_runs: runs }, { status: runsStatus });
    }
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

async function recordDigest(table: "deliveries" | "call_updates", sentAt: string) {
  await env.DB.prepare("INSERT INTO users (id, email) VALUES ('u1', 'a@example.org')").run();
  const insert =
    table === "deliveries"
      ? env.DB.prepare(
          "INSERT INTO deliveries (user_id, call_id, sent_at) VALUES ('u1', 'c1', ?)",
        ).bind(sentAt)
      : env.DB.prepare(
          "INSERT INTO call_updates (user_id, call_id, changed_at, sent_at) VALUES ('u1', 'c1', ?1, ?1)",
        ).bind(sentAt);
  await insert.run();
}

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

describe("daily job retries", () => {
  it.each([
    ["12:00 summer time", "2026-07-01T10:00:00Z"],
    ["15:00 summer time", "2026-07-01T13:00:00Z"],
    ["12:00 winter time", "2026-12-01T11:00:00Z"],
    ["15:00 winter time", "2026-12-01T14:00:00Z"],
  ])("starts the job again at %s after a failed run", async (_name, utc) => {
    await fire(utc);
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].url).toBe(DISPATCH_URL);
  });

  it("starts the job again after a run that timed out", async () => {
    runs = [{ conclusion: "timed_out" }];
    await fire("2026-07-01T10:00:00Z");
    expect(dispatches).toHaveLength(1);
  });

  it.each([
    ["succeeded", "success"],
    ["was cancelled", "cancelled"],
    ["is still going", null],
  ])("leaves it alone when the latest run %s", async (_name, conclusion) => {
    runs = [{ conclusion }];
    await fire("2026-07-01T10:00:00Z");
    expect(dispatches).toHaveLength(0);
  });

  it("leaves it alone when the workflow has no runs", async () => {
    runs = [];
    await fire("2026-07-01T10:00:00Z");
    expect(dispatches).toHaveLength(0);
  });

  it.each(["deliveries", "call_updates"] as const)(
    "sends no second digest: leaves a failed run alone after %s today",
    async (table) => {
      await recordDigest(table, "2026-07-01T08:05:12+00:00"); // the format of the pipeline
      await fire("2026-07-01T10:00:00Z");
      await fire("2026-07-01T13:00:00Z");
      expect(dispatches).toHaveLength(0);
    },
  );

  it("starts the job again when the last digest went out yesterday", async () => {
    await recordDigest("deliveries", "2026-06-30T23:59:59+00:00");
    await fire("2026-07-01T10:00:00Z");
    expect(dispatches).toHaveLength(1);
  });

  it("does nothing at the hours between", async () => {
    await fire("2026-07-01T11:00:00Z"); // 13:00
    await fire("2026-12-01T12:00:00Z"); // 13:00
    expect(dispatches).toHaveLength(0);
  });

  it("fails when GitHub does not list the runs", async () => {
    runsStatus = 401;
    await expect(fire("2026-07-01T10:00:00Z")).rejects.toThrow("401");
    expect(dispatches).toHaveLength(0);
  });

  it("does not look at past runs for the daily start", async () => {
    runs = [{ conclusion: "success" }];
    await fire("2026-07-01T08:00:00Z");
    expect(dispatches).toHaveLength(1);
  });

  it("dispatches nothing when D1 cannot tell", async () => {
    vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1 unavailable");
    });
    await expect(fire("2026-07-01T10:00:00Z")).rejects.toThrow("D1 unavailable");
    expect(dispatches).toHaveLength(0);
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
