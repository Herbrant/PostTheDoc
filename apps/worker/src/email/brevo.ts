/** Email delivery through Brevo's transactional API (the pipeline uses the same one). */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmail = (email: Email) => Promise<void>;

/** Brevo's error code only: its message may quote the recipient. */
async function errorCode(resp: Response): Promise<string> {
  const body: unknown = await resp.json().catch(() => null);
  const code = body && typeof body === "object" && "code" in body ? body.code : "";
  return typeof code === "string" ? code : "";
}

/** The transport configured by the environment: Brevo, or the logs in local development. */
export function createMailer(env: Env): SendEmail {
  if (env.EMAIL_MODE === "log") {
    return async (email) => {
      console.log(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
    };
  }
  const sender = { email: env.SENDER_EMAIL, name: env.SENDER_NAME };
  return async (email) => {
    const resp = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        sender,
        // Anonymous opens; clicks too with *Anonymous email tracking* on (docs/DEVELOPMENT.md).
        to: [{ email: email.to, contactPixelTrackingConsent: false }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
    });
    if (!resp.ok) throw new Error(`Brevo responded ${resp.status} ${await errorCode(resp)}`);
  };
}
