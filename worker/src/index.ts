import { Hono } from "hono";
import type { Context } from "hono";
import {
  activateUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  insertPendingUser,
  toPreferences,
  touchLastEmail,
  updatePreferences,
  type UserRow,
} from "./db";
import { confirmEmail, manageLinkEmail, sendEmail } from "./email";
import { type Locale, pickLocale, strings } from "./i18n";
import { reference } from "./reference";
import { sign, verify } from "./tokens";
import { verifyTurnstile } from "./turnstile";
import { manageLinkSchema, preferencesSchema, subscribeSchema } from "./validate";

type AppEnv = { Bindings: Env; Variables: { user: UserRow } };
type Ctx = Context<AppEnv>;
type EmailTarget = Pick<UserRow, "id" | "email" | "token_version" | "locale">;

const CONFIRM_TTL = 48 * 3600;
const EMAIL_COOLDOWN = 5 * 60; // at most one email every 5 minutes per address

const app = new Hono<AppEnv>();

const now = () => Math.floor(Date.now() / 1000);
const canEmail = (user: UserRow) => !user.last_email_at || now() - user.last_email_at >= EMAIL_COOLDOWN;
const requestLocale = (c: Ctx) => pickLocale(c.req.header("Accept-Language"));

async function manageUrl(c: Ctx, user: Pick<UserRow, "id" | "token_version">, query = "") {
  const token = await sign(c.env.TOKEN_SECRET, "manage", user.id, user.token_version);
  return `${new URL(c.req.url).origin}/manage${query}#t=${token}`;
}

async function sendConfirm(c: Ctx, user: EmailTarget) {
  const token = await sign(c.env.TOKEN_SECRET, "confirm", user.id, user.token_version, CONFIRM_TTL);
  const url = `${new URL(c.req.url).origin}/confirm?t=${encodeURIComponent(token)}`;
  await sendEmail(c.env, confirmEmail(user.locale, user.email, url));
  await touchLastEmail(c.env.DB, user.id, now());
}

async function sendManageLink(c: Ctx, user: EmailTarget) {
  await sendEmail(c.env, manageLinkEmail(user.locale, user.email, await manageUrl(c, user)));
  await touchLastEmail(c.env.DB, user.id, now());
}

async function readJson(c: Ctx): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function checkTurnstile(c: Ctx, token: string) {
  return verifyTurnstile(c.env.TURNSTILE_SECRET, token, c.req.header("CF-Connecting-IP"));
}

function page(c: Ctx, locale: Locale, title: string, body: string, status: 200 | 400 = 200) {
  return c.html(
    `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · PostTheDoc</title><link rel="stylesheet" href="/style.css"></head>
<body><main class="container"><h1><a href="/">PostTheDoc</a></h1><h2>${title}</h2>${body}</main></body></html>`,
    status,
  );
}

app.get("/api/config", (c) => {
  c.header("Cache-Control", "public, max-age=3600");
  return c.json({ turnstileSiteKey: c.env.TURNSTILE_SITE_KEY, ...reference });
});

app.post("/api/subscribe", async (c) => {
  const parsed = subscribeSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  const { email: rawEmail, turnstileToken, ...prefs } = parsed.data;
  if (!(await checkTurnstile(c, turnstileToken))) return c.json({ error: "captcha" }, 400);

  const email = rawEmail.trim().toLowerCase();
  const user = await getUserByEmail(c.env.DB, email);
  try {
    if (!user) {
      const id = crypto.randomUUID();
      await insertPendingUser(c.env.DB, id, email, prefs);
      await sendConfirm(c, { id, email, token_version: 0, locale: prefs.locale });
    } else if (user.status === "pending") {
      await updatePreferences(c.env.DB, user.id, prefs);
      if (canEmail(user)) await sendConfirm(c, { ...user, locale: prefs.locale });
    } else if (canEmail(user)) {
      // Already subscribed: keep the preferences and do not reveal that the address exists.
      await sendManageLink(c, user);
    }
  } catch (err) {
    console.error("Sending email failed", err);
    return c.json({ error: "email" }, 502);
  }
  return c.json({ ok: true });
});

app.post("/api/manage-link", async (c) => {
  const parsed = manageLinkSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  if (!(await checkTurnstile(c, parsed.data.turnstileToken))) {
    return c.json({ error: "captcha" }, 400);
  }

  const user = await getUserByEmail(c.env.DB, parsed.data.email.trim().toLowerCase());
  try {
    if (user && canEmail(user)) {
      if (user.status === "active") await sendManageLink(c, user);
      else await sendConfirm(c, user);
    }
  } catch (err) {
    console.error("Sending email failed", err);
    return c.json({ error: "email" }, 502);
  }
  return c.json({ ok: true });
});

app.get("/confirm", async (c) => {
  const data = await verify(c.env.TOKEN_SECRET, c.req.query("t") ?? "", ["confirm"]);
  const user = data && (await getUserById(c.env.DB, data.userId));
  if (!data || !user || user.token_version !== data.version) {
    const locale = requestLocale(c);
    const t = strings[locale];
    return page(c, locale, t.invalidLinkTitle, `<p>${t.invalidConfirm}</p>`, 400);
  }
  if (user.status === "pending") await activateUser(c.env.DB, user.id);
  return c.redirect(await manageUrl(c, user, "?welcome=1"), 303);
});

app.use("/api/preferences", async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const data = await verify(c.env.TOKEN_SECRET, token, ["manage"]);
  const user = data && (await getUserById(c.env.DB, data.userId));
  if (!data || !user || user.status !== "active" || user.token_version !== data.version) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("user", user);
  await next();
});

app.get("/api/preferences", (c) => {
  const user = c.get("user");
  return c.json({ email: user.email, ...toPreferences(user) });
});

app.put("/api/preferences", async (c) => {
  const parsed = preferencesSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  await updatePreferences(c.env.DB, c.get("user").id, parsed.data);
  return c.json({ ok: true });
});

app.delete("/api/preferences", async (c) => {
  await deleteUser(c.env.DB, c.get("user").id);
  return c.json({ ok: true });
});

/** Resolve the unsubscribe token: null if invalid, `user: null` if already unsubscribed. */
async function unsubscribeTarget(c: Ctx) {
  const data = await verify(c.env.TOKEN_SECRET, c.req.query("t") ?? "", ["unsubscribe"]);
  if (!data) return null;
  const user = await getUserById(c.env.DB, data.userId);
  return { user: user && user.token_version === data.version ? user : null };
}

app.get("/unsubscribe", async (c) => {
  const target = await unsubscribeTarget(c);
  const locale = target?.user?.locale ?? requestLocale(c);
  const t = strings[locale];
  if (!target) return page(c, locale, t.invalidLinkTitle, `<p>${t.invalidUnsubscribe}</p>`, 400);
  if (!target.user) {
    return page(c, locale, t.alreadyUnsubscribedTitle, `<p>${t.alreadyUnsubscribed}</p>`);
  }
  // Ask for explicit confirmation: some mail clients open links to preview them.
  const action = `/unsubscribe?t=${encodeURIComponent(c.req.query("t") ?? "")}`;
  return page(
    c,
    locale,
    t.unsubscribeTitle,
    `<p>${t.unsubscribeQuestion}</p>
<form method="post" action="${action}"><button type="submit" class="danger">${t.unsubscribeButton}</button></form>`,
  );
});

// Used both by the form above and by mail clients' one-click unsubscribe (RFC 8058).
app.post("/unsubscribe", async (c) => {
  const target = await unsubscribeTarget(c);
  const locale = target?.user?.locale ?? requestLocale(c);
  const t = strings[locale];
  if (!target) return page(c, locale, t.invalidLinkTitle, `<p>${t.invalidUnsubscribe}</p>`, 400);
  if (target.user) await deleteUser(c.env.DB, target.user.id);
  return page(c, locale, t.unsubscribedTitle, `<p>${t.unsubscribed}</p>`);
});

export default app;
