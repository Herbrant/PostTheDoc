import { DAILY_EMAILS } from "@postthedoc/shared/contract";

/**
 * Version of the privacy notice users consent to: the "last updated" date of
 * apps/web/src/content/privacy/*.md, to be changed together with it.
 */
export const PRIVACY_VERSION = "2026-09-25";

/**
 * Emails the Worker may send per UTC day (confirmations and manage links). The email provider's
 * daily quota is shared with the daily digests, so the Worker keeps well below it: past the
 * limit the forms answer "rate_limited" until the next day.
 */
export const DAILY_EMAIL_LIMIT = DAILY_EMAILS.worker;

/** Requests per client IP (IPv6: per /64) and window, counted by the RateLimiter object. */
export const RATE_LIMITS = {
  /** The endpoints that send emails. */
  email: { limit: 5, periodSeconds: 60 },
  /** The manage page's API: no captcha, and its writes count against D1's daily limit. */
  api: { limit: 30, periodSeconds: 60 },
} as const;
export type RateLimitScope = keyof typeof RATE_LIMITS;

/** Confirmation emails a pending address can receive before it is purged (see 0003 migration). */
export const MAX_CONFIRMATIONS = 5;

/** Largest JSON body accepted by the API: preferences with every code fit well within it. */
export const MAX_BODY_BYTES = 64 * 1024;
