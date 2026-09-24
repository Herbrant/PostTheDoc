import { Hono } from "hono";
import { cors } from "hono/cors";
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
const MANAGE_TTL = 30 * 24 * 3600; // same as MANAGE_TTL in src/postthedoc/pipeline.py
const EMAIL_COOLDOWN = 5 * 60; // at most one email every 5 minutes per address

const app = new Hono<AppEnv>();

const now = () => Math.floor(Date.now() / 1000);
const canEmail = (user: UserRow) => !user.last_email_at || now() - user.last_email_at >= EMAIL_COOLDOWN;
const requestLocale = (c: Ctx) => pickLocale(c.req.header("Accept-Language"));

/** URL of a frontend page, e.g. frontendUrl(c, "it", "manage/"). */
const frontendUrl = (c: Ctx, locale: Locale, path = "") =>
  `${c.env.FRONTEND_URL.replace(/\/+$/, "")}/${locale}/${path}`;

async function manageUrl(
  c: Ctx,
  user: Pick<UserRow, "id" | "token_version" | "locale">,
  query = "",
) {
  const token = await sign(c.env.TOKEN_SECRET, "manage", user.id, user.token_version, MANAGE_TTL);
  return `${frontendUrl(c, user.locale, "manage/")}${query}#t=${token}`;
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

// Minimal look for the few pages rendered by the Worker; the rest of the UI lives in frontend/.
const PAGE_CSS = `body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;color:#16151b;
background:#f5f0e8;line-height:1.6}main{max-width:620px;margin:0 auto;padding:64px 20px}
h1{font:600 1.3rem Georgia,serif}h1 a{color:inherit;text-decoration:none}
h2{font-size:clamp(2.2rem,7vw,3.4rem);line-height:1;letter-spacing:-.04em;margin:48px 0 20px}
p{color:#6f6865;font-size:1.05rem}a{color:#7157ff}button{font:inherit;font-weight:700;
min-height:50px;padding:0 24px;border:1px solid #d8401f;border-radius:999px;background:none;
color:#d8401f;cursor:pointer}button:hover{background:#d8401f;color:#fff}`;

function page(c: Ctx, locale: Locale, title: string, body: string, status: 200 | 400 = 200) {
  return c.html(
    `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · PostTheDoc</title><style>${PAGE_CSS}</style></head>
<body><main><h1><a href="${frontendUrl(c, locale)}">PostTheDoc</a></h1><h2>${title}</h2>${body}</main></body></html>`,
    status,
  );
}

// The frontend is served from another origin (GitHub Pages).
app.use("/api/*", (c, next) =>
  cors({
    origin: [new URL(c.env.FRONTEND_URL).origin],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })(c, next),
);

app.get("/", (c) => c.redirect(frontendUrl(c, requestLocale(c)), 302));

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

/** Resolve the confirmation token: the user it belongs to, or null if invalid or expired. */
async function confirmTarget(c: Ctx) {
  const data = await verify(c.env.TOKEN_SECRET, c.req.query("t") ?? "", ["confirm"]);
  const user = data && (await getUserById(c.env.DB, data.userId));
  return data && user && user.token_version === data.version ? user : null;
}

function invalidConfirm(c: Ctx) {
  const locale = requestLocale(c);
  const t = strings[locale];
  const again = `<a href="${frontendUrl(c, locale, "subscribe/")}">${t.subscribeAgain}</a>`;
  return page(c, locale, t.invalidLinkTitle, `<p>${t.invalidConfirm} ${again}.</p>`, 400);
}

app.get("/confirm", async (c) => {
  const user = await confirmTarget(c);
  if (!user) return invalidConfirm(c);
  const t = strings[user.locale];
  // Ask for explicit confirmation: mail scanners open links, and must not subscribe anyone.
  const action = `/confirm?t=${encodeURIComponent(c.req.query("t") ?? "")}`;
  return page(
    c,
    user.locale,
    t.confirmTitle,
    `<p>${t.confirmQuestion}</p>
<form method="post" action="${action}"><button type="submit">${t.confirmButton}</button></form>`,
  );
});

app.post("/confirm", async (c) => {
  const user = await confirmTarget(c);
  if (!user) return invalidConfirm(c);
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
