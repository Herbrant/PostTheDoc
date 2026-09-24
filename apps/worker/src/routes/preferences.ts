import { API_ROUTES, type PreferencesResponse } from "@postthedoc/shared/api";
import { preferencesSchema } from "@postthedoc/shared/schemas";
import { Hono } from "hono";
import { toPreferences } from "../db/users";
import { ok } from "../lib/http";
import { jsonBody } from "../lib/validation";
import { requireUser } from "../middleware/auth";
import type { AppEnv } from "../types";

/** The manage page's API, authenticated by the manage token of the email links. */
export const preferencesRoutes = new Hono<AppEnv>()
  .use(API_ROUTES.preferences, requireUser)
  .use(`${API_ROUTES.preferences}/*`, requireUser)
  .get(API_ROUTES.preferences, (c) => {
    const user = c.get("user");
    return c.json<PreferencesResponse>({ email: user.email, ...toPreferences(user) });
  })
  .put(API_ROUTES.preferences, jsonBody(preferencesSchema), async (c) => {
    await c.get("users").updatePreferences(c.get("user").id, c.req.valid("json"));
    return ok(c);
  })
  .delete(API_ROUTES.preferences, async (c) => {
    await c.get("users").delete(c.get("user").id);
    return ok(c);
  })
  // Everything stored about the user, in a machine-readable format (GDPR Art. 15 and 20).
  .get(API_ROUTES.export, async (c) => {
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
      deliveries: await c.get("users").deliveries(user.id),
    });
  });
