import { API_PATHS, LINK_PARAMS } from "@postthedoc/shared/contract";
import { Hono } from "hono";
import { html } from "hono/html";
import { PRIVACY_VERSION } from "../config";
import type { UserRow } from "../db/users";
import { pickLocale, strings } from "../i18n";
import { linkToken } from "../lib/http";
import { verify } from "../lib/tokens";
import { frontendUrl } from "../lib/urls";
import { confirmForm, renderPage } from "../pages/layout";
import { manageUrl } from "../services/notifications";
import type { AppContext, AppEnv } from "../types";

/** The user the confirmation link belongs to, or null if it is invalid or expired. */
async function confirmTarget(c: AppContext): Promise<UserRow | null> {
  const data = await verify(c.env.TOKEN_SECRET, linkToken(c), ["confirm"]);
  const user = data && (await c.get("users").findById(data.userId));
  return data && user?.token_version === data.version ? user : null;
}

function invalidLink(c: AppContext) {
  const locale = pickLocale(c.req.header("Accept-Language"));
  const t = strings[locale];
  const again = html`<a href="${frontendUrl(c, "subscribe", locale)}">${t.subscribeAgain}</a>`;
  return renderPage(c, {
    locale,
    title: t.invalidLinkTitle,
    body: html`<p>${t.invalidConfirm} ${again}.</p>`,
    status: 400,
  });
}

export const confirmRoutes = new Hono<AppEnv>()
  // Ask for explicit confirmation: mail scanners open links, and must not subscribe anyone.
  .get(API_PATHS.confirm, async (c) => {
    const user = await confirmTarget(c);
    if (!user) return invalidLink(c);
    const t = strings[user.locale];
    const action = `${API_PATHS.confirm}?${LINK_PARAMS.token}=${encodeURIComponent(linkToken(c))}`;
    return renderPage(c, {
      locale: user.locale,
      title: t.confirmTitle,
      body: html`<p>${t.confirmQuestion}</p>${confirmForm(action, t.confirmButton)}`,
    });
  })
  .post(API_PATHS.confirm, async (c) => {
    const user = await confirmTarget(c);
    if (!user) return invalidLink(c);
    if (user.status === "pending") await c.get("users").activate(user.id, PRIVACY_VERSION);
    return c.redirect(await manageUrl(c, user, true), 303);
  });
