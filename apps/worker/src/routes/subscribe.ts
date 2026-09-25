import { API_ROUTES } from "@postthedoc/shared/api";
import { manageLinkSchema, subscribeSchema } from "@postthedoc/shared/schemas";
import { Hono } from "hono";
import { apiError, ok } from "../lib/http";
import { jsonBody } from "../lib/validation";
import { emailLimits } from "../middleware/limits";
import { passesCaptcha } from "../services/captcha";
import { sendConfirmation, sendManageLink } from "../services/notifications";
import type { AppEnv } from "../types";

/**
 * Public endpoints of the forms. Neither reveals whether an address is subscribed: they always
 * answer ok, and only the owner of the address learns more, by email.
 */
export const subscribeRoutes = new Hono<AppEnv>()
  .post(API_ROUTES.subscribe, jsonBody(subscribeSchema), emailLimits, async (c) => {
    const { email, turnstileToken, ...prefs } = c.req.valid("json");
    if (!(await passesCaptcha(c, turnstileToken))) return apiError(c, "captcha", 400);

    const users = c.get("users");
    const existing = await users.findByEmail(email);
    const created = existing ? null : await users.insertPending(email, prefs);
    // insertPending returns null when a concurrent request created the address first.
    const user = existing ?? created ?? (await users.findByEmail(email));
    if (!user) throw new Error("Subscribing user neither found nor created");

    if (created) {
      await sendConfirmation(c, created);
    } else if (user.status === "pending") {
      await users.updatePreferences(user.id, prefs);
      await sendConfirmation(c, { ...user, locale: prefs.locale });
    } else {
      // Already subscribed: keep the preferences, send the link to change them.
      await sendManageLink(c, user);
    }
    return ok(c);
  })
  .post(API_ROUTES.manageLink, jsonBody(manageLinkSchema), emailLimits, async (c) => {
    const { email, turnstileToken } = c.req.valid("json");
    if (!(await passesCaptcha(c, turnstileToken))) return apiError(c, "captcha", 400);

    const user = await c.get("users").findByEmail(email);
    if (user?.status === "active") await sendManageLink(c, user);
    else if (user) await sendConfirmation(c, user);
    return ok(c);
  });
