import { type Locale, type SitePage, sitePath } from "@postthedoc/shared/contract";
import type { AppContext } from "../types";

/** URL of a web app page, e.g. frontendUrl(c, "manage", "it"). */
export function frontendUrl(c: AppContext, page: SitePage, locale: Locale): string {
  return c.env.FRONTEND_URL.replace(/\/+$/, "") + sitePath(page, locale);
}

/** Origin of the web app: the only one allowed by CORS and by the forms' CSP. */
export const frontendOrigin = (env: Env): string => new URL(env.FRONTEND_URL).origin;

/** URL of this Worker, for links it sends by email. */
export const workerUrl = (c: AppContext, path: string): string =>
  new URL(path, c.req.url).toString();
