import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sign } from "../src/tokens";

const BASE = "https://postthedoc.test";
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

beforeEach(async () => {
  sent = [];
  turnstileOk = true;
  await env.DB.exec("DELETE FROM users");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://challenges.cloudflare.com/")) {
      return Response.json({ success: turnstileOk });
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

/** Open the confirmation link of the last email and return the manage token. */
async function confirmLastEmail(): Promise<string> {
  const confirm = await call(linkIn(sent.at(-1)!).slice(BASE.length));
  expect(confirm.status).toBe(303);
  const location = confirm.headers.get("Location")!;
  expect(location).toContain("/manage?welcome=1#t=");
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

  it("rejects a failed captcha without storing anything", async () => {
    turnstileOk = false;
    const resp = await subscribe();
    expect(resp.status).toBe(400);
    expect(await resp.json()).toEqual({ error: "captcha" });
    expect(sent).toHaveLength(0);
    expect(await countUsers()).toBe(0);
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

  it("sends a manage link to already active users without changing preferences", async () => {
    await subscribeAndConfirm({ locale: "en" });
    await env.DB.exec("UPDATE users SET last_email_at = 0");

    await subscribe({ roles: ["technologist"], locale: "it" });

    expect(sent).toHaveLength(2);
    expect(sent[1].subject).toBe("Your link to manage PostTheDoc"); // stored locale wins
    const row = await env.DB.prepare("SELECT roles FROM users").first<{ roles: string }>();
    expect(JSON.parse(row!.roles)).toEqual(["researcher"]);
  });

  it("rejects tampered confirm links with a localized page", async () => {
    await subscribe();
    const resp = await call(linkIn(sent[0]).slice(BASE.length) + "x", {
      headers: { "Accept-Language": "en-GB,en;q=0.9" },
    });
    expect(resp.status).toBe(400);
    expect(await resp.text()).toContain("Invalid link");
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
