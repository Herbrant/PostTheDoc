/** The Worker: JSON API of the web app, and the pages behind the links sent by email. */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { apiError } from "./lib/http";
import { repositories } from "./middleware/context";
import { apiBodyLimit } from "./middleware/limits";
import { apiCors, securityHeaders } from "./middleware/security";
import { confirmRoutes } from "./routes/confirm";
import { preferencesRoutes } from "./routes/preferences";
import { rootRoutes } from "./routes/root";
import { subscribeRoutes } from "./routes/subscribe";
import { unsubscribeRoutes } from "./routes/unsubscribe";
import { EmailError, QuotaError } from "./services/notifications";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>()
  .use("*", securityHeaders)
  .use("/api/*", apiCors)
  .use("/api/*", apiBodyLimit)
  .use("*", repositories)
  .route("/", rootRoutes)
  .route("/", subscribeRoutes)
  .route("/", preferencesRoutes)
  .route("/", confirmRoutes)
  .route("/", unsubscribeRoutes);

app.notFound((c) =>
  c.req.path.startsWith("/api/") ? apiError(c, "not_found", 404) : c.text("Not found", 404),
);

app.onError((err, c) => {
  if (err instanceof QuotaError) {
    console.warn(err.message);
    return apiError(c, "rate_limited", 429);
  }
  if (err instanceof EmailError) {
    console.error(err.message, err.cause);
    return apiError(c, "email", 502);
  }
  if (err instanceof HTTPException && err.status === 400) {
    return apiError(c, "invalid", 400); // e.g. a malformed JSON body
  }
  console.error("Unhandled error", err);
  return apiError(c, "internal", 500);
});

export default app;
export { RateLimiter } from "./durable/rate-limiter";
