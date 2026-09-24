/** The emails the Worker sends, throttled per user. */
import { API_PATHS, LINK_PARAMS, TOKEN_TTL_SECONDS } from "@postthedoc/shared/contract";
import type { UserRow } from "../db/users";
import { createMailer, type Email } from "../email/brevo";
import { confirmationEmail, manageLinkEmail } from "../email/templates";
import { nowSeconds } from "../lib/time";
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

/** Send an email to the user, unless another one went out during the cooldown. */
async function sendThrottled(c: AppContext, user: Recipient, build: () => Promise<Email>) {
  const users = c.get("users");
  if (!(await users.claimEmailSlot(user.id, nowSeconds(), EMAIL_COOLDOWN_SECONDS))) return;
  try {
    await createMailer(c.env)(await build());
  } catch (err) {
    await users.releaseEmailSlot(user.id);
    throw new EmailError(err);
  }
}

/** Delivery to the email provider failed (as opposed to, say, the database). */
export class EmailError extends Error {
  constructor(cause: unknown) {
    super("Sending email failed", { cause });
    this.name = "EmailError";
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
