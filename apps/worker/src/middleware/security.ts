import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { frontendOrigin } from "../lib/urls";

/**
 * Strict headers for every response. The pages rendered here use inline styles only; their
 * forms post back to the Worker, which redirects to the web app.
 */
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    styleSrc: ["'unsafe-inline'"],
    formAction: ["'self'", (c) => frontendOrigin(c.env)],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
  },
  crossOriginResourcePolicy: false, // the API is fetched by the web app's origin
});

/** The web app is served from another origin (GitHub Pages): allow it, and only it. */
export const apiCors = cors({
  origin: (origin, c) => (origin === frontendOrigin(c.env) ? origin : null),
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});
