/** The emails the Worker sends, throttled per user. */
import { API_PATHS, LINK_PARAMS, TOKEN_TTL_SECONDS } from "@postthedoc/shared/contract";
import { DAILY_EMAIL_LIMIT, MAX_CONFIRMATIONS } from "../config";
import type { UserRow } from "../db/users";
import { createMailer, type Email } from "../email/brevo";
import { confirmationEmail, manageLinkEmail } from "../email/templates";
import { nowSeconds, today } from "../lib/time";
import { sign } from "../lib/tokens";
import { frontendUrl, workerUrl } from "../lib/urls";
import type { AppContext } from "../types";

/** At most one email every 5 minutes per address. */
export const EMAIL_COOLDOWN_SECONDS = 5 * 60;

export type Recipient = Pick<UserRow, "id" | "email" | "token_version" | "locale">;

/** Link to the manage page, with a manage token in the fragment (never sent to servers). */
export async function manageUrl(c: AppContext, user: Recipient, welcome = false): Promise<string> {
  const { token, welcome: welcomeParam } = LINK_PARAMS;
  const signed = await sign(
    c.env.TOKEN_SECRET,
    "manage",
    user.id,
    user.token_version,
    TOKEN_TTL_SECONDS.manage,
  );
  const query = welcome ? `?${welcomeParam}=1` : "";
  return `${frontendUrl(c, "manage", user.locale)}${query}#${token}=${signed}`;
}

/**
 * Send an email to the user, unless another one went out during the cooldown or a pending
 * address got all its confirmations already. Throws QuotaError past the Worker's daily limit.
 */
async function sendThrottled(c: AppContext, user: Recipient, build: () => Promise<Email>) {
  const users = c.get("users");
  const quota = c.get("quota");
  const day = today();
  const claimed = await users.claimEmailSlot(
    user.id,
    nowSeconds(),
    EMAIL_COOLDOWN_SECONDS,
    MAX_CONFIRMATIONS,
  );
  if (!claimed) return;
  if (!(await quota.claim(day, DAILY_EMAIL_LIMIT))) {
    await users.releaseEmailSlot(user.id);
    throw new QuotaError();
  }
  try {
    await createMailer(c.env)(await build());
  } catch (err) {
    await Promise.all([users.releaseEmailSlot(user.id), quota.release(day)]);
    throw new EmailError(err);
  }
}

/** True if the Worker cannot send more emails today. */
export const quotaExhausted = (c: AppContext): Promise<boolean> =>
  c.get("quota").exhausted(today(), DAILY_EMAIL_LIMIT);

/** Delivery to the email provider failed (as opposed to, say, the database). */
export class EmailError extends Error {
  constructor(cause: unknown) {
    super("Sending email failed", { cause });
    this.name = "EmailError";
  }
}

/** The Worker sent all the emails it may send today. */
export class QuotaError extends Error {
  constructor() {
    super("Daily email limit reached");
    this.name = "QuotaError";
  }
}

export function sendConfirmation(c: AppContext, user: Recipient): Promise<void> {
  return sendThrottled(c, user, async () => {
    const token = await sign(
      c.env.TOKEN_SECRET,
      "confirm",
      user.id,
      user.token_version,
      TOKEN_TTL_SECONDS.confirm,
    );
    const url = workerUrl(
      c,
      `${API_PATHS.confirm}?${LINK_PARAMS.token}=${encodeURIComponent(token)}`,
    );
    return confirmationEmail(user.locale, user.email, {
      url,
      privacyUrl: frontendUrl(c, "privacy", user.locale),
    });
  });
}

export function sendManageLink(c: AppContext, user: Recipient): Promise<void> {
  return sendThrottled(c, user, async () =>
    manageLinkEmail(user.locale, user.email, {
      url: await manageUrl(c, user),
      privacyUrl: frontendUrl(c, "privacy", user.locale),
    }),
  );
}
