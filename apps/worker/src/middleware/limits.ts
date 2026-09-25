import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { MAX_BODY_BYTES } from "../config";
import { apiError } from "../lib/http";
import { quotaExhausted } from "../services/notifications";
import type { AppEnv } from "../types";

/** Refuse oversized bodies before parsing them. */
export const apiBodyLimit = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => apiError(c, "invalid", 413),
});

/**
 * Guard the endpoints that send emails: a per-IP rate limit, and the Worker's daily email limit
 * checked up front, so that "rate_limited" never tells whether an address is subscribed.
 */
export const emailLimits = createMiddleware<AppEnv>(async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const { success } = await c.env.EMAIL_RATE_LIMITER.limit({ key: ip });
  if (!success || (await quotaExhausted(c))) return apiError(c, "rate_limited", 429);
  await next();
});
