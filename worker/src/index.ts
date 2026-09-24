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
import { reference } from "./reference";
import { sign, verify } from "./tokens";
import { verifyTurnstile } from "./turnstile";
import { manageLinkSchema, preferencesSchema, subscribeSchema } from "./validate";

type AppEnv = { Bindings: Env; Variables: { user: UserRow } };
type Ctx = Context<AppEnv>;

const CONFIRM_TTL = 48 * 3600;
const EMAIL_COOLDOWN = 5 * 60; // al massimo un'email ogni 5 minuti per indirizzo

const app = new Hono<AppEnv>();

const now = () => Math.floor(Date.now() / 1000);
const canEmail = (user: UserRow) => !user.last_email_at || now() - user.last_email_at >= EMAIL_COOLDOWN;

async function manageUrl(c: Ctx, user: Pick<UserRow, "id" | "token_version">, query = "") {
  const token = await sign(c.env.TOKEN_SECRET, "manage", user.id, user.token_version);
  return `${new URL(c.req.url).origin}/manage${query}#t=${token}`;
}

async function sendConfirm(c: Ctx, user: Pick<UserRow, "id" | "email" | "token_version">) {
  const token = await sign(c.env.TOKEN_SECRET, "confirm", user.id, user.token_version, CONFIRM_TTL);
  const url = `${new URL(c.req.url).origin}/confirm?t=${encodeURIComponent(token)}`;
  await sendEmail(c.env, confirmEmail(user.email, url));
  await touchLastEmail(c.env.DB, user.id, now());
}

async function sendManageLink(c: Ctx, user: UserRow) {
  await sendEmail(c.env, manageLinkEmail(user.email, await manageUrl(c, user)));
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

function page(c: Ctx, title: string, body: string, status: 200 | 400 = 200) {
  return c.html(
    `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
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
      await sendConfirm(c, { id, email, token_version: 0 });
    } else if (user.status === "pending") {
      await updatePreferences(c.env.DB, user.id, prefs);
      if (canEmail(user)) await sendConfirm(c, user);
    } else if (canEmail(user)) {
      // Già iscritto: non si toccano le preferenze e non si rivela che l'indirizzo esiste.
      await sendManageLink(c, user);
    }
  } catch (err) {
    console.error("Invio email fallito", err);
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
    console.error("Invio email fallito", err);
    return c.json({ error: "email" }, 502);
  }
  return c.json({ ok: true });
});

app.get("/confirm", async (c) => {
  const data = await verify(c.env.TOKEN_SECRET, c.req.query("t") ?? "", ["confirm"]);
  const user = data && (await getUserById(c.env.DB, data.userId));
  if (!data || !user || user.token_version !== data.version) {
    return page(
      c,
      "Link non valido",
      `<p>Il link di conferma non è valido o è scaduto. <a href="/">Iscriviti di nuovo</a>.</p>`,
      400,
    );
  }
  if (user.status === "pending") await activateUser(c.env.DB, user.id);
  return c.redirect(await manageUrl(c, user, "?benvenuto=1"), 303);
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

async function unsubscribeTarget(c: Ctx) {
  const data = await verify(c.env.TOKEN_SECRET, c.req.query("t") ?? "", ["unsubscribe"]);
  if (!data) return null;
  const user = await getUserById(c.env.DB, data.userId);
  return { user: user && user.token_version === data.version ? user : null };
}

app.get("/unsubscribe", async (c) => {
  const target = await unsubscribeTarget(c);
  if (!target) return page(c, "Link non valido", "<p>Il link di disiscrizione non è valido.</p>", 400);
  if (!target.user) return page(c, "Già disiscritto", "<p>Questo indirizzo non riceve più notifiche.</p>");
  // Conferma esplicita: alcuni client di posta aprono i link in anteprima.
  const action = `/unsubscribe?t=${encodeURIComponent(c.req.query("t") ?? "")}`;
  return page(
    c,
    "Disiscrizione",
    `<p>Vuoi smettere di ricevere le notifiche di PostTheDoc? I tuoi dati verranno cancellati.</p>
<form method="post" action="${action}"><button type="submit" class="danger">Disiscrivimi</button></form>`,
  );
});

// Usato sia dal form qui sopra sia dal one-click dei client di posta (RFC 8058).
app.post("/unsubscribe", async (c) => {
  const target = await unsubscribeTarget(c);
  if (!target) return page(c, "Link non valido", "<p>Il link di disiscrizione non è valido.</p>", 400);
  if (target.user) await deleteUser(c.env.DB, target.user.id);
  return page(c, "Disiscrizione completata", "<p>Non riceverai più email e i tuoi dati sono stati cancellati.</p>");
});

export default app;
