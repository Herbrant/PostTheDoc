import { Hono } from "hono";
import { pickLocale } from "../i18n";
import { frontendUrl } from "../lib/urls";
import type { AppEnv } from "../types";

/** The Worker has no home page: send visitors to the web app, in their language. */
export const rootRoutes = new Hono<AppEnv>().get("/", (c) =>
  c.redirect(frontendUrl(c, "home", pickLocale(c.req.header("Accept-Language"))), 302),
);
