import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { MAX_BODY_BYTES, RATE_LIMITS, type RateLimitScope } from "../config";
import { apiError } from "../lib/http";
import { quotaExhausted } from "../services/notifications";
import type { AppContext, AppEnv } from "../types";

/** Refuse oversized bodies before parsing them. */
export const apiBodyLimit = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => apiError(c, "invalid", 413),
});

/**
 * Rate limit key of a client address. An IPv6 host usually owns a whole /64, so keying on the
 * full address would hand it 2^64 separate limits.
 */
export function clientKey(ip: string): string {
  // IPv4, including IPv4-mapped IPv6 (::ffff:1.2.3.4), whose first 64 bits are all zero.
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  const prefix = groups.slice(0, 4).map((group) => Number.parseInt(group, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

/**
 * Count the request against the client's limit in `scope`: false past it. Fails open, with the
 * daily email limit still in place: a limiter outage must not lock everybody out.
 */
async function withinLimit(c: AppContext, scope: RateLimitScope): Promise<boolean> {
  const { limit, periodSeconds } = RATE_LIMITS[scope];
  const key = clientKey(c.req.header("CF-Connecting-IP") ?? "unknown");
  try {
    return await c.env.RATE_LIMITER.getByName(`${scope}:${key}`).hit(limit, periodSeconds);
  } catch (err) {
    console.error("Rate limiter unavailable", err);
    return true;
  }
}

/**
 * Guard the endpoints that send emails: a per-IP rate limit, and the Worker's daily email limit
 * checked up front, so that "rate_limited" never tells whether an address is subscribed.
 */
export const emailLimits = createMiddleware<AppEnv>(async (c, next) => {
  if (!(await withinLimit(c, "email")) || (await quotaExhausted(c))) {
    return apiError(c, "rate_limited", 429);
  }
  await next();
});

/**
 * Guard the manage page's API, which needs no captcha: every write counts against D1's daily
 * limit, which the daily job needs to record its digests.
 */
export const apiLimits = createMiddleware<AppEnv>(async (c, next) => {
  if (!(await withinLimit(c, "api"))) return apiError(c, "rate_limited", 429);
  await next();
});
