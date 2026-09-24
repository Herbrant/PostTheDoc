import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/scripts/lib/api";

const PREFS = {
  locale: "it" as const,
  roles: ["phd"],
  sectors: [],
  regions: [],
  institutions: [],
  include_unspecified: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

const mockFetch = (response: Response | Error) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    if (response instanceof Error) throw response;
    return response;
  });

describe("api", () => {
  it("returns the data of successful calls", async () => {
    const fetch = mockFetch(Response.json({ email: "a@example.org", ...PREFS }));
    const result = await api.getPreferences("token");
    expect(result).toEqual({ ok: true, data: { email: "a@example.org", ...PREFS } });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:8787/api/preferences");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("sends JSON bodies", async () => {
    const fetch = mockFetch(Response.json({ ok: true }));
    await api.savePreferences("token", PREFS);
    const [, init] = fetch.mock.calls[0] ?? [];
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(PREFS);
  });

  it("reports API errors with their issues", async () => {
    const issues = [{ path: ["roles"], message: "Pick at least one role" }];
    mockFetch(Response.json({ error: "invalid", issues }, { status: 400 }));
    expect(await api.savePreferences("token", PREFS)).toEqual({
      ok: false,
      status: 400,
      error: "invalid",
      issues,
    });
  });

  it("reports unknown errors as internal", async () => {
    mockFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    expect(await api.deleteSubscription("token")).toEqual({
      ok: false,
      status: 502,
      error: "internal",
    });
  });

  it("reports network failures", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    expect(await api.requestManageLink({ email: "a@example.org", turnstileToken: "t" })).toEqual({
      ok: false,
      status: 0,
      error: "network",
    });
  });
});
