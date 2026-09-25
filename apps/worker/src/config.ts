/**
 * Version of the privacy notice users consent to: the "last updated" date of
 * apps/web/src/content/privacy/*.md, to be changed together with it.
 */
export const PRIVACY_VERSION = "2026-09-24";

/**
 * Emails the Worker may send per UTC day (confirmations and manage links). The email provider's
 * daily quota is shared with the daily digests (Brevo's free plan: 300), so the Worker keeps
 * well below it: past the limit the forms answer "rate_limited" until the next day.
 */
export const DAILY_EMAIL_LIMIT = 100;

/** Confirmation emails a pending address can receive before it is purged (see 0003 migration). */
export const MAX_CONFIRMATIONS = 5;

/** Largest JSON body accepted by the API: preferences with every code fit well within it. */
export const MAX_BODY_BYTES = 64 * 1024;
