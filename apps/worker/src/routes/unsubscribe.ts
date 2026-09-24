import { API_PATHS, LINK_PARAMS } from "@postthedoc/shared/contract";
import { Hono } from "hono";
import { html } from "hono/html";
import type { UserRow } from "../db/users";
import { pickLocale, strings } from "../i18n";
import { linkToken } from "../lib/http";
import { verify } from "../lib/tokens";
import { confirmForm, renderPage } from "../pages/layout";
import type { AppContext, AppEnv } from "../types";

/**
 * Resolve the unsubscribe link: `valid` is false for a forged or malformed link; `user` is null
 * when it was valid but the user has already left.
 */
async function unsubscribeTarget(c: AppContext): Promise<{ valid: boolean; user: UserRow | null }> {
  const data = await verify(c.env.TOKEN_SECRET, linkToken(c), ["unsubscribe"]);
  if (!data) return { valid: false, user: null };
  const user = await c.get("users").findById(data.userId);
  return { valid: true, user: user?.token_version === data.version ? user : null };
}

async function resolve(c: AppContext) {
  const target = await unsubscribeTarget(c);
  const locale = target.user?.locale ?? pickLocale(c.req.header("Accept-Language"));
  return { ...target, locale, t: strings[locale] };
}

export const unsubscribeRoutes = new Hono<AppEnv>()
  // Ask for explicit confirmation: some mail clients open links to preview them.
  .get(API_PATHS.unsubscribe, async (c) => {
    const { valid, user, locale, t } = await resolve(c);
    if (!valid) {
      const body = html`<p>${t.invalidUnsubscribe}</p>`;
      return renderPage(c, { locale, title: t.invalidLinkTitle, body, status: 400 });
    }
    if (!user) {
      const body = html`<p>${t.alreadyUnsubscribed}</p>`;
      return renderPage(c, { locale, title: t.alreadyUnsubscribedTitle, body });
    }
    const action = `${API_PATHS.unsubscribe}?${LINK_PARAMS.token}=${encodeURIComponent(linkToken(c))}`;
    return renderPage(c, {
      locale,
      title: t.unsubscribeTitle,
      body: html`<p>${t.unsubscribeQuestion}</p>${confirmForm(action, t.unsubscribeButton, "danger")}`,
    });
  })
  // Used both by the form above and by mail clients' one-click unsubscribe (RFC 8058).
  .post(API_PATHS.unsubscribe, async (c) => {
    const { valid, user, locale, t } = await resolve(c);
    if (!valid) {
      const body = html`<p>${t.invalidUnsubscribe}</p>`;
      return renderPage(c, { locale, title: t.invalidLinkTitle, body, status: 400 });
    }
    if (user) await c.get("users").delete(user.id);
    return renderPage(c, {
      locale,
      title: t.unsubscribedTitle,
      body: html`<p>${t.unsubscribed}</p>`,
    });
  });
