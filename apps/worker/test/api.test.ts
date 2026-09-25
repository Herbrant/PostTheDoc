import { env, exports } from "cloudflare:workers";
import { ISSUES_URL } from "@postthedoc/shared/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { sign } from "../src/lib/tokens";

const BASE = "https://postthedoc.test";
const FRONTEND = "https://front.test/app";
const PREFS = {
  locale: "it",
  roles: ["researcher"],
  sectors: ["INFO-01"],
  regions: ["IT-82"],
  institutions: [],
  include_unspecified: true,
};

interface SentEmail {
  to: string;
  subject: string;
  text: string;
  tracking: unknown;
  replyTo: unknown;
}

let sent: SentEmail[];
let turnstileOk: boolean;
let turnstileHost: string;
let rateLimited: boolean;
let apiRateLimited: boolean;

beforeEach(async () => {
  sent = [];
  turnstileOk = true;
  turnstileHost = "front.test";
  rateLimited = false;
  apiRateLimited = false;
  await env.DB.exec("DELETE FROM users");
  await env.DB.exec("DELETE FROM email_quota");
  vi.spyOn(env.EMAIL_RATE_LIMITER, "limit").mockImplementation(async () => ({
    success: !rateLimited,
  }));
  vi.spyOn(env.API_RATE_LIMITER, "limit").mockImplementation(async () => ({
    success: !apiRateLimited,
  }));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://challenges.cloudflare.com/")) {
      // The tests solve the manage-link form's challenge as "t", the subscribe form's as others.
      const token = init?.body instanceof FormData ? init.body.get("response") : null;
      const action = token === "t" ? "manage-link" : "subscribe";
      return Response.json({ success: turnstileOk, hostname: turnstileHost, action });
    }
    if (url.startsWith("https://api.brevo.com/")) {
      const body = JSON.parse(String(init?.body));
      sent.push({
        to: body.to[0].email,
        subject: body.subject,
        text: body.textContent,
        tracking: body.to[0].contactPixelTrackingConsent,
        replyTo: body.replyTo,
      });
      return Response.json({ messageId: "test" }, { status: 201 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function call(path: string, init?: RequestInit) {
  return exports.default.fetch(new Request(BASE + path, { redirect: "manual", ...init }));
}

function json(method: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return call(path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function subscribe(overrides: Record<string, unknown> = {}) {
  return json("POST", "/api/subscribe", {
    email: "Alice@Example.org",
    turnstileToken: "token",
    ...PREFS,
    ...overrides,
  });
}

/** The value, failing the test if it is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected a value");
  return value;
}

function linkIn(email: SentEmail): string {
  return defined(email.text.match(/https:\/\/\S+/))[0];
}

function countUsers() {
  return env.DB.prepare("SELECT count(*) AS n FROM users").first("n");
}

/** Confirm through the link of the last email (the page's button) and return the manage token. */
async function confirmLastEmail(): Promise<string> {
  const confirm = await call(linkIn(defined(sent.at(-1))).slice(BASE.length), { method: "POST" });
  expect(confirm.status).toBe(303);
  const location = defined(confirm.headers.get("Location"));
  expect(location).toMatch(new RegExp(`^${FRONTEND}/(it|en)/manage/\\?welcome=1#t=`));
  return location.split("#t=")[1];
}

async function subscribeAndConfirm(overrides: Record<string, unknown> = {}): Promise<string> {
  await subscribe(overrides);
  return confirmLastEmail();
}

describe("subscription", () => {
  it("completes subscribe → confirm → manage → delete", async () => {
    const resp = await subscribe();
    expect(resp.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("alice@example.org");
    expect(sent[0].subject).toBe("Conferma la tua iscrizione a PostTheDoc");

    const pending = await env.DB.prepare("SELECT status FROM users").first<{ status: string }>();
    expect(pending?.status).toBe("pending");

    const auth = { Authorization: `Bearer ${await confirmLastEmail()}` };

    const current = await call("/api/preferences", { headers: auth });
    expect(await current.json()).toEqual({ email: "alice@example.org", ...PREFS });

    const updated = { ...PREFS, locale: "en", roles: ["phd", "phd"], regions: [] };
    expect((await json("PUT", "/api/preferences", updated, auth)).status).toBe(200);
    const after = await (await call("/api/preferences", { headers: auth })).json();
    expect(after).toMatchObject({ locale: "en", roles: ["phd"], regions: [] });

    expect((await json("PUT", "/api/preferences", { ...PREFS, roles: [] }, auth)).status).toBe(400);
    expect((await json("PUT", "/api/preferences", { ...PREFS, locale: "fr" }, auth)).status).toBe(
      400,
    );

    expect((await call("/api/preferences", { method: "DELETE", headers: auth })).status).toBe(200);
    expect((await call("/api/preferences", { headers: auth })).status).toBe(401);
  });

  it("sends the confirmation email in the chosen language", async () => {
    await subscribe({ locale: "en" });
    expect(sent[0].subject).toBe("Confirm your PostTheDoc subscription");
    expect(sent[0].text).toContain("expires in 48 hours");
  });

  it("redirects the confirmation to the manage page in the user's language", async () => {
    await subscribe({ locale: "en" });
    const confirm = await call(linkIn(sent[0]).slice(BASE.length), { method: "POST" });
    expect(confirm.headers.get("Location")).toContain(`${FRONTEND}/en/manage/?welcome=1#t=`);
  });

  it("does not hand out manage links again once confirmed", async () => {
    await subscribe();
    const path = linkIn(sent[0]).slice(BASE.length);
    await confirmLastEmail();

    for (const method of ["GET", "POST"]) {
      const resp = await call(path, { method });
      expect(resp.status).toBe(200);
      expect(resp.headers.get("Location")).toBeNull();
      const page = await resp.text();
      expect(page).toContain("Iscrizione già confermata");
      expect(page).toContain(`href="${FRONTEND}/it/manage/"`);
      expect(page).not.toContain("#t=");
    }
  });

  it("links the privacy notice on the confirmation page", async () => {
    await subscribe({ locale: "en" });
    const page = await (await call(linkIn(sent[0]).slice(BASE.length))).text();
    expect(page).toContain(`href="${FRONTEND}/en/privacy/"`);
  });

  it("does not confirm on GET: mail scanners open links", async () => {
    await subscribe({ locale: "en" });
    const get = await call(linkIn(sent[0]).slice(BASE.length));
    expect(get.status).toBe(200);
    const html = await get.text();
    expect(html).toContain('method="post"');
    expect(html).toContain("Confirm subscription");
    expect(html).not.toContain("#t=");
    const row = await env.DB.prepare("SELECT status FROM users").first<{ status: string }>();
    expect(row?.status).toBe("pending");
  });

  it("rejects a failed captcha without storing anything", async () => {
    turnstileOk = false;
    const resp = await subscribe();
    expect(resp.status).toBe(400);
    expect(await resp.json()).toEqual({ error: "captcha" });
    expect(sent).toHaveLength(0);
    expect(await countUsers()).toBe(0);
  });

  it("rejects captchas solved on another site", async () => {
    turnstileHost = "evil.test";
    const resp = await subscribe();
    expect(resp.status).toBe(400);
    expect(await resp.json()).toEqual({ error: "captcha" });
    expect(await countUsers()).toBe(0);
  });

  it("rejects captchas solved for the other form", async () => {
    expect((await subscribe({ turnstileToken: "t" })).status).toBe(400);
    const link = { email: "alice@example.org", turnstileToken: "token" };
    expect((await json("POST", "/api/manage-link", link)).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("asks to retry the captcha when Cloudflare cannot be reached", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("network down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const resp = await subscribe();
    expect(resp.status).toBe(400);
    expect(await resp.json()).toEqual({ error: "captcha" });
  });

  it("fails closed when production uses Cloudflare's always-pass test secret", async () => {
    const request = new Request(`${BASE}/api/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.org", turnstileToken: "token", ...PREFS }),
    });
    const testKey = { ...env, TURNSTILE_SECRET: "1x0000000000000000000000000000000AA" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const resp = await app.fetch(request, testKey);
    expect(resp.status).toBe(400);
    expect(await countUsers()).toBe(0);
  });

  it("rejects oversized captcha tokens", async () => {
    expect((await subscribe({ turnstileToken: "x".repeat(2049) })).status).toBe(400);
  });

  it("rejects unknown codes", async () => {
    expect((await subscribe({ sectors: ["NOPE-99"] })).status).toBe(400);
    expect((await subscribe({ locale: "de" })).status).toBe(400);
  });

  it("requires a sector", async () => {
    expect((await subscribe({ sectors: [] })).status).toBe(400);
    expect(await countUsers()).toBe(0);
  });

  it("does not resend within the cooldown but keeps the latest preferences", async () => {
    await subscribe();
    await subscribe({ roles: ["technologist"] });
    expect(sent).toHaveLength(1);
    const row = await env.DB.prepare("SELECT roles FROM users").first<{ roles: string }>();
    expect(JSON.parse(defined(row).roles)).toEqual(["technologist"]);
  });

  it("sends a single email to concurrent requests for the same address", async () => {
    await subscribeAndConfirm();
    await env.DB.exec("UPDATE users SET last_email_at = 0");
    const body = { email: "alice@example.org", turnstileToken: "t" };
    const link = () => json("POST", "/api/manage-link", body);

    await Promise.all([link(), link(), link()]);

    expect(sent).toHaveLength(2); // confirmation + one manage link
  });

  it("lets the user retry right away when sending fails", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const original = defined(fetchMock.getMockImplementation());
    fetchMock.mockImplementationOnce(original); // Turnstile
    fetchMock.mockImplementationOnce(async () => new Response("down", { status: 503 })); // Brevo
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await subscribe()).status).toBe(502);

    expect((await subscribe()).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("sends a manage link to already active users without changing preferences", async () => {
    await subscribeAndConfirm({ locale: "en" });
    await env.DB.exec("UPDATE users SET last_email_at = 0");

    await subscribe({ roles: ["technologist"], locale: "it" });

    expect(sent).toHaveLength(2);
    expect(sent[1].subject).toBe("Your link to manage PostTheDoc"); // stored locale wins
    expect(linkIn(sent[1])).toContain(`${FRONTEND}/en/manage/#t=`);
    const row = await env.DB.prepare("SELECT roles FROM users").first<{ roles: string }>();
    expect(JSON.parse(defined(row).roles)).toEqual(["researcher"]);
  });

  it("issues manage links that expire", async () => {
    const token = await subscribeAndConfirm();
    const payload = atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"));
    const exp = Number(payload.split(".").at(-1));
    expect(exp - Date.now() / 1000).toBeGreaterThan(29 * 24 * 3600);

    const user = await env.DB.prepare("SELECT id FROM users").first<{ id: string }>();
    const expired = await sign("test-secret", "manage", defined(user).id, 0, -60);
    const auth = { Authorization: `Bearer ${expired}` };
    const resp = await call("/api/preferences", { headers: auth });
    expect(resp.status).toBe(401);
  });

  it("rejects tampered confirm links with a localized page", async () => {
    await subscribe();
    const resp = await call(`${linkIn(sent[0]).slice(BASE.length)}x`, {
      headers: { "Accept-Language": "en-GB,en;q=0.9" },
    });
    expect(resp.status).toBe(400);
    const html = await resp.text();
    expect(html).toContain("Invalid link");
    expect(html).toContain(`href="${FRONTEND}/en/subscribe/"`);
  });
});

describe("personal data", () => {
  it("records when and to which privacy notice the user consented", async () => {
    await subscribe();
    const before = await env.DB.prepare("SELECT confirmed_at, privacy_version FROM users").first();
    expect(before).toEqual({ confirmed_at: null, privacy_version: null });

    await confirmLastEmail();
    const after = await env.DB.prepare("SELECT confirmed_at, privacy_version FROM users").first<{
      confirmed_at: string;
      privacy_version: string;
    }>();
    expect(after?.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(after?.privacy_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("exports everything stored about the user", async () => {
    const auth = { Authorization: `Bearer ${await subscribeAndConfirm()}` };
    const user = await env.DB.prepare("SELECT id FROM users").first<{ id: string }>();
    await env.DB.prepare("INSERT INTO deliveries (user_id, call_id, sent_at) VALUES (?, ?, ?)")
      .bind(defined(user).id, "mur:1", "2026-09-24T06:00:00+00:00")
      .run();

    const resp = await call("/api/preferences/export", { headers: auth });
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Disposition")).toContain("postthedoc-data.json");
    expect(resp.headers.get("Cache-Control")).toBe("no-store");
    const data = await resp.json<Record<string, unknown>>();
    expect(data).toMatchObject({ email: "alice@example.org", status: "active", ...PREFS });
    expect(data.confirmed_at).toBeTruthy();
    expect(data.privacy_version).toBeTruthy();
    expect(data.deliveries).toEqual([{ call_id: "mur:1", sent_at: "2026-09-24T06:00:00+00:00" }]);
    expect(data.last_email_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.confirmations_sent).toBe(1);

    // Every column but the internal keys: a new column must be added to the export too.
    const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('users')").all();
    const columns = results.map((row) => String(row.name));
    const internal = ["id", "token_version"];
    expect(Object.keys(data)).toEqual(
      expect.arrayContaining(columns.filter((c) => !internal.includes(c))),
    );
  });

  it("keeps personal data out of caches", async () => {
    const auth = { Authorization: `Bearer ${await subscribeAndConfirm()}` };
    const resp = await call("/api/preferences", { headers: auth });
    expect(resp.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not export without a valid manage token", async () => {
    await subscribeAndConfirm();
    expect((await call("/api/preferences/export")).status).toBe(401);
    const auth = { Authorization: "Bearer nope" };
    expect((await call("/api/preferences/export", { headers: auth })).status).toBe(401);
  });

  it("links the privacy notice in every email", async () => {
    await subscribeAndConfirm({ locale: "en" });
    await env.DB.exec("UPDATE users SET last_email_at = 0");
    await json("POST", "/api/manage-link", { email: "alice@example.org", turnstileToken: "t" });
    expect(sent).toHaveLength(2);
    for (const email of sent) expect(email.text).toContain(`${FRONTEND}/en/privacy/`);
  });

  it("tells recipients that replies are not read", async () => {
    await subscribeAndConfirm({ locale: "en" });
    await env.DB.exec("UPDATE users SET last_email_at = 0");
    await json("POST", "/api/manage-link", { email: "alice@example.org", turnstileToken: "t" });
    expect(sent).toHaveLength(2);
    for (const email of sent) {
      expect(email.replyTo).toBeUndefined();
      expect(email.text).toContain("replies are not read");
      expect(email.text).toContain(`Report a problem on GitHub: ${ISSUES_URL}`);
    }
  });

  it("asks Brevo not to track opens and clicks per recipient", async () => {
    await subscribe();
    expect(sent[0].tracking).toBe(false);
  });
});

describe("frontend integration", () => {
  it("allows CORS requests from the frontend origin only", async () => {
    const preflight = (origin: string) =>
      call("/api/preferences", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });

    const ok = await preflight("https://front.test");
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://front.test");
    expect(ok.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(ok.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain(
      "authorization",
    );

    const other = await preflight("https://evil.test");
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("sends security headers that still let the forms redirect to the frontend", async () => {
    const resp = await call("/unsubscribe?t=nope");
    const csp = defined(resp.headers.get("Content-Security-Policy"));
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self' https://front.test");
    expect(resp.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(resp.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(resp.headers.get("Cross-Origin-Resource-Policy")).toBeNull();
  });

  it("redirects the root to the frontend", async () => {
    const resp = await call("/", { headers: { "Accept-Language": "en-US" } });
    expect(resp.status).toBe(302);
    expect(resp.headers.get("Location")).toBe(`${FRONTEND}/en/`);
  });
});

describe("unsubscribe from the email link", () => {
  it("asks for confirmation on GET and deletes on POST", async () => {
    await subscribeAndConfirm();
    const user = await env.DB.prepare("SELECT id FROM users").first<{ id: string }>();
    // Same token the Python pipeline generates.
    const token = await sign("test-secret", "unsubscribe", defined(user).id, 0);

    const get = await call(`/unsubscribe?t=${token}`);
    expect(get.status).toBe(200);
    const html = await get.text();
    expect(html).toContain('method="post"');
    expect(html).toContain("Disiscrivimi"); // the user's locale is Italian
    expect(await countUsers()).toBe(1);

    const post = await call(`/unsubscribe?t=${token}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(post.status).toBe(200);
    expect(await countUsers()).toBe(0);
  });

  it("rejects invalid tokens", async () => {
    const resp = await call("/unsubscribe?t=nope", { headers: { "Accept-Language": "it-IT" } });
    expect(resp.status).toBe(400);
    expect(await resp.text()).toContain("Link non valido");
  });
});

describe("errors", () => {
  it("answers malformed JSON with a JSON 400", async () => {
    const resp = await call("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(resp.status).toBe(400);
    expect(await resp.json()).toMatchObject({ error: "invalid" });
  });

  it("reports which fields are invalid", async () => {
    const resp = await subscribe({ roles: [] });
    const body = await resp.json<{ error: string; issues: { path: string[] }[] }>();
    expect(body.error).toBe("invalid");
    expect(body.issues.map((issue) => issue.path[0])).toContain("roles");
  });

  it("answers unknown API routes with a JSON 404", async () => {
    const resp = await call("/api/nope");
    expect(resp.status).toBe(404);
    expect(await resp.json()).toEqual({ error: "not_found" });
  });

  it("does not report database failures as email failures", async () => {
    const request = new Request(`${BASE}/api/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.org", turnstileToken: "token", ...PREFS }),
    });
    const brokenDb = {
      prepare() {
        throw new Error("D1 is down");
      },
    } as unknown as D1Database;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resp = await app.fetch(request, { ...env, DB: brokenDb });

    expect(resp.status).toBe(500);
    expect(await resp.json()).toEqual({ error: "internal" });
  });
});

describe("manage link requests", () => {
  const request = () =>
    json("POST", "/api/manage-link", { email: "alice@example.org", turnstileToken: "t" });

  it("send nothing, but answer ok, for unknown addresses", async () => {
    const resp = await request();
    expect(resp.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("send the confirmation again to pending users", async () => {
    await subscribe();
    await env.DB.exec("UPDATE users SET last_email_at = 0");
    await request();
    expect(sent.map((email) => email.subject)).toEqual([
      "Conferma la tua iscrizione a PostTheDoc",
      "Conferma la tua iscrizione a PostTheDoc",
    ]);
  });
});

describe("email limits", () => {
  const today = () => new Date().toISOString().slice(0, 10);

  it("stop confirming a pending address after a few emails, silently", async () => {
    for (let i = 0; i < 7; i++) {
      await env.DB.exec("UPDATE users SET last_email_at = 0");
      expect((await subscribe()).status).toBe(200);
    }
    expect(sent).toHaveLength(5);

    // Once confirmed, the address gets its manage links again.
    await confirmLastEmail();
    await env.DB.exec("UPDATE users SET last_email_at = 0");
    await subscribe();
    expect(sent).toHaveLength(6);
  });

  it("do not count failed sends against the confirmations", async () => {
    await subscribe();
    const fetchMock = vi.mocked(globalThis.fetch);
    const original = defined(fetchMock.getMockImplementation());
    fetchMock.mockImplementationOnce(original); // Turnstile
    fetchMock.mockImplementationOnce(async () => new Response("down", { status: 503 })); // Brevo
    vi.spyOn(console, "error").mockImplementation(() => {});
    await env.DB.exec("UPDATE users SET last_email_at = 0");
    expect((await subscribe()).status).toBe(502);

    const row = await env.DB.prepare("SELECT confirmations_sent AS n FROM users").first("n");
    expect(row).toBe(1);
    const quota = await env.DB.prepare("SELECT sent FROM email_quota").first("sent");
    expect(quota).toBe(1);
  });

  it("answer rate_limited once the Worker's daily emails are used up", async () => {
    await env.DB.prepare("INSERT INTO email_quota (day, sent) VALUES (?, 100)").bind(today()).run();
    const resp = await subscribe();
    expect(resp.status).toBe(429);
    expect(await resp.json()).toEqual({ error: "rate_limited" });
    expect(sent).toHaveLength(0);
    // Also for unknown addresses: the answer does not tell whether one is subscribed.
    const link = await json("POST", "/api/manage-link", {
      email: "x@example.org",
      turnstileToken: "t",
    });
    expect(link.status).toBe(429);
  });

  it("count the Worker's emails per day and forget the past days", async () => {
    await env.DB.prepare("INSERT INTO email_quota (day, sent) VALUES ('2000-01-01', 100)").run();
    await subscribe();
    const { results } = await env.DB.prepare("SELECT day, sent FROM email_quota").all();
    expect(results).toEqual([{ day: today(), sent: 1 }]);
  });

  it("answer rate_limited to clients over the per-IP limit", async () => {
    rateLimited = true;
    const resp = await subscribe();
    expect(resp.status).toBe(429);
    expect(await countUsers()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("share the per-IP limit across an IPv6 /64", async () => {
    await call("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "CF-Connecting-IP": "2001:db8:1:2::abcd" },
      body: JSON.stringify({ email: "alice@example.org", turnstileToken: "token", ...PREFS }),
    });
    expect(env.EMAIL_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "2001:db8:1:2::/64" });
  });

  it("rate limit the manage page's API before touching the database", async () => {
    const auth = { Authorization: `Bearer ${await subscribeAndConfirm()}` };
    apiRateLimited = true;
    const resp = await json("PUT", "/api/preferences", { ...PREFS, locale: "en" }, auth);
    expect(resp.status).toBe(429);
    expect(await resp.json()).toEqual({ error: "rate_limited" });
    expect(await env.DB.prepare("SELECT locale FROM users").first("locale")).toBe("it");
    expect((await call("/api/preferences/export", { headers: auth })).status).toBe(429);
  });

  it("reject oversized bodies", async () => {
    const resp = await subscribe({ roles: ["x".repeat(70 * 1024)] });
    expect(resp.status).toBe(413);
    expect(await resp.json()).toEqual({ error: "invalid" });
  });
});

describe("concurrency", () => {
  it("creates a single user for concurrent subscriptions of a new address", async () => {
    const responses = await Promise.all([subscribe(), subscribe(), subscribe()]);
    expect(responses.map((resp) => resp.status)).toEqual([200, 200, 200]);
    expect(await countUsers()).toBe(1);
    expect(sent).toHaveLength(1);
  });
});

describe("manage tokens", () => {
  it("stop working when the user's token version changes", async () => {
    const auth = { Authorization: `Bearer ${await subscribeAndConfirm()}` };
    await env.DB.exec("UPDATE users SET token_version = token_version + 1");
    expect((await call("/api/preferences", { headers: auth })).status).toBe(401);
  });
});

describe("pages", () => {
  it("style the unsubscribe button as destructive and the confirm button as primary", async () => {
    await subscribe();
    const confirm = await (await call(linkIn(sent[0]).slice(BASE.length))).text();
    expect(confirm).toContain('<button type="submit">');

    await confirmLastEmail();
    const user = await env.DB.prepare("SELECT id FROM users").first<{ id: string }>();
    const token = await sign("test-secret", "unsubscribe", user?.id ?? "", 0);
    const unsubscribe = await (await call(`/unsubscribe?t=${token}`)).text();
    expect(unsubscribe).toContain('<button type="submit" class="danger">');
  });

  it("tells users who already left", async () => {
    const token = await sign("test-secret", "unsubscribe", "gone", 0);
    const resp = await call(`/unsubscribe?t=${token}`, { headers: { "Accept-Language": "en" } });
    expect(resp.status).toBe(200);
    expect(await resp.text()).toContain("Already unsubscribed");
  });
});
