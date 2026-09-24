import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import type { Context } from "hono";
import {
  activateUser,
  claimEmailSlot,
  deleteUser,
  getDeliveries,
  getUserByEmail,
  getUserById,
  insertPendingUser,
  releaseEmailSlot,
  toPreferences,
  updatePreferences,
  type UserRow,
} from "./db";
import { confirmEmail, type Email, manageLinkEmail, sendEmail } from "./email";
import { type Locale, pickLocale, strings } from "./i18n";
import { reference } from "./reference";
import { sign, verify } from "./tokens";
import { isTestSecret, verifyTurnstile } from "./turnstile";
import { manageLinkSchema, preferencesSchema, subscribeSchema } from "./validate";

type AppEnv = { Bindings: Env; Variables: { user: UserRow } };
type Ctx = Context<AppEnv>;
type EmailTarget = Pick<UserRow, "id" | "email" | "token_version" | "locale">;

const CONFIRM_TTL = 48 * 3600;
const MANAGE_TTL = 30 * 24 * 3600; // same as MANAGE_TTL in src/postthedoc/pipeline.py
const EMAIL_COOLDOWN = 5 * 60; // at most one email every 5 minutes per address
// Version of the privacy notice users consent to: the "last updated" date of
// frontend/src/content/privacy/*.md, to be changed together with it.
const PRIVACY_VERSION = "2026-09-24";

const app = new Hono<AppEnv>();

const now = () => Math.floor(Date.now() / 1000);
const requestLocale = (c: Ctx) => pickLocale(c.req.header("Accept-Language"));

/** URL of a frontend page, e.g. frontendUrl(c, "it", "manage/"). */
const frontendUrl = (c: Ctx, locale: Locale, path = "") =>
  `${c.env.FRONTEND_URL.replace(/\/+$/, "")}/${locale}/${path}`;

const privacyUrl = (c: Ctx, locale: Locale) => frontendUrl(c, locale, "privacy/");

async function manageUrl(
  c: Ctx,
  user: Pick<UserRow, "id" | "token_version" | "locale">,
  query = "",
) {
  const token = await sign(c.env.TOKEN_SECRET, "manage", user.id, user.token_version, MANAGE_TTL);
  return `${frontendUrl(c, user.locale, "manage/")}${query}#t=${token}`;
}

/** Send an email to the user, unless another one went out during the cooldown. */
async function sendThrottled(c: Ctx, userId: string, build: () => Promise<Email>) {
  if (!(await claimEmailSlot(c.env.DB, userId, now(), EMAIL_COOLDOWN))) return;
  try {
    await sendEmail(c.env, await build());
  } catch (err) {
    await releaseEmailSlot(c.env.DB, userId);
    throw err;
  }
}

function sendConfirm(c: Ctx, user: EmailTarget) {
  return sendThrottled(c, user.id, async () => {
    const { id, token_version } = user;
    const token = await sign(c.env.TOKEN_SECRET, "confirm", id, token_version, CONFIRM_TTL);
    const url = `${new URL(c.req.url).origin}/confirm?t=${encodeURIComponent(token)}`;
    return confirmEmail(user.locale, user.email, { url, privacyUrl: privacyUrl(c, user.locale) });
  });
}

function sendManageLink(c: Ctx, user: EmailTarget) {
  return sendThrottled(c, user.id, async () =>
    manageLinkEmail(user.locale, user.email, {
      url: await manageUrl(c, user),
      privacyUrl: privacyUrl(c, user.locale),
    }),
  );
}

async function readJson(c: Ctx): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

async function checkTurnstile(c: Ctx, token: string) {
  const ip = c.req.header("CF-Connecting-IP");
  if (c.env.EMAIL_MODE === "log") return verifyTurnstile(c.env.TURNSTILE_SECRET, token, ip);
  if (isTestSecret(c.env.TURNSTILE_SECRET)) {
    // Fail closed: a dummy key left in production would let every bot through.
    console.error("TURNSTILE_SECRET is a Cloudflare test key: set the real one");
    return false;
  }
  const hostname = new URL(c.env.FRONTEND_URL).hostname;
  return verifyTurnstile(c.env.TURNSTILE_SECRET, token, ip, hostname);
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

// The pages above use inline styles only; their forms post here and redirect to the frontend.
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      styleSrc: ["'unsafe-inline'"],
      formAction: ["'self'", (c) => new URL(c.env.FRONTEND_URL).origin],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
    crossOriginResourcePolicy: false, // the API is fetched by the frontend's origin
  }),
);

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
      await sendConfirm(c, { ...user, locale: prefs.locale });
    } else {
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
    if (user) {
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
  if (user.status === "pending") await activateUser(c.env.DB, user.id, PRIVACY_VERSION);
  return c.redirect(await manageUrl(c, user, "?welcome=1"), 303);
});

/** Authenticate the manage token of the Authorization header and expose its user. */
const requireUser = createMiddleware<AppEnv>(async (c, next) => {
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

app.use("/api/preferences", requireUser);
app.use("/api/preferences/*", requireUser);

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

// Everything stored about the user, in a machine-readable format (GDPR Art. 15 and 20).
app.get("/api/preferences/export", async (c) => {
  const user = c.get("user");
  c.header("Cache-Control", "no-store");
  c.header("Content-Disposition", 'attachment; filename="postthedoc-data.json"');
  return c.json({
    email: user.email,
    status: user.status,
    ...toPreferences(user),
    created_at: user.created_at,
    updated_at: user.updated_at,
    confirmed_at: user.confirmed_at,
    privacy_version: user.privacy_version,
    deliveries: await getDeliveries(c.env.DB, user.id),
  });
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
