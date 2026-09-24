import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { sign } from "../src/tokens";

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
}

let sent: SentEmail[];
let turnstileOk: boolean;
let turnstileHost: string;

beforeEach(async () => {
  sent = [];
  turnstileOk = true;
  turnstileHost = "front.test";
  await env.DB.exec("DELETE FROM users");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://challenges.cloudflare.com/")) {
      return Response.json({ success: turnstileOk, hostname: turnstileHost });
    }
    if (url.startsWith("https://api.brevo.com/")) {
      const body = JSON.parse(String(init?.body));
      sent.push({ to: body.to[0].email, subject: body.subject, text: body.textContent });
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

function linkIn(email: SentEmail): string {
  return email.text.match(/https:\/\/\S+/)![0];
}

function countUsers() {
  return env.DB.prepare("SELECT count(*) AS n FROM users").first("n");
}

/** Confirm through the link of the last email (the page's button) and return the manage token. */
async function confirmLastEmail(): Promise<string> {
  const confirm = await call(linkIn(sent.at(-1)!).slice(BASE.length), { method: "POST" });
  expect(confirm.status).toBe(303);
  const location = confirm.headers.get("Location")!;
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

  it("does not resend within the cooldown but keeps the latest preferences", async () => {
    await subscribe();
    await subscribe({ roles: ["technologist"] });
    expect(sent).toHaveLength(1);
    const row = await env.DB.prepare("SELECT roles FROM users").first<{ roles: string }>();
    expect(JSON.parse(row!.roles)).toEqual(["technologist"]);
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
    const original = fetchMock.getMockImplementation()!;
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
    expect(JSON.parse(row!.roles)).toEqual(["researcher"]);
  });

  it("issues manage links that expire", async () => {
    const token = await subscribeAndConfirm();
    const payload = atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"));
    const exp = Number(payload.split(".").at(-1));
    expect(exp - Date.now() / 1000).toBeGreaterThan(29 * 24 * 3600);

    const user = await env.DB.prepare("SELECT id FROM users").first<{ id: string }>();
    const expired = await sign("test-secret", "manage", user!.id, 0, -60);
    const auth = { Authorization: `Bearer ${expired}` };
    const resp = await call("/api/preferences", { headers: auth });
    expect(resp.status).toBe(401);
  });

  it("rejects tampered confirm links with a localized page", async () => {
    await subscribe();
    const resp = await call(linkIn(sent[0]).slice(BASE.length) + "x", {
      headers: { "Accept-Language": "en-GB,en;q=0.9" },
    });
    expect(resp.status).toBe(400);
    const html = await resp.text();
    expect(html).toContain("Invalid link");
    expect(html).toContain(`href="${FRONTEND}/en/subscribe/"`);
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
    const token = await sign("test-secret", "unsubscribe", user!.id, 0);

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
