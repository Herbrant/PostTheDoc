import { createMiddleware } from "hono/factory";
import { apiError } from "../lib/http";
import { verify } from "../lib/tokens";
import type { AppEnv } from "../types";

const BEARER = "Bearer ";

/** Authenticate the manage token of the Authorization header and expose its user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith(BEARER) ? auth.slice(BEARER.length) : "";
  const data = await verify(c.env.TOKEN_SECRET, token, ["manage"]);
  const user = data && (await c.get("users").findById(data.userId));
  if (!data || !user || user.status !== "active" || user.token_version !== data.version) {
    return apiError(c, "unauthorized", 401);
  }
  c.set("user", user);
  await next();
});
