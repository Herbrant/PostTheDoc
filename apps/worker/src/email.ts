import { type Locale, strings } from "./i18n";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(env: Env, email: Email): Promise<void> {
  if (env.EMAIL_MODE === "log") {
    console.log(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
    return;
  }
  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME },
      // No per-recipient open/click tracking: Brevo only counts them in aggregate.
      to: [{ email: email.to, contactPixelTrackingConsent: false }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Brevo responded ${resp.status}: ${await resp.text()}`);
  }
}

interface Links {
  url: string;
  privacyUrl: string;
}

function layout(
  locale: Locale,
  paragraph: string,
  { url, privacyUrl }: Links,
  cta: string,
  note: string,
): string {
  const t = strings[locale];
  return `<!DOCTYPE html><html lang="${locale}"><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;">PostTheDoc</h1>
<p>${paragraph}</p>
<p><a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">${cta}</a></p>
<p style="font-size:13px;color:#52606d;">${note}</p>
<p style="font-size:13px;color:#52606d;"><a href="${privacyUrl}" style="color:#52606d;">${t.privacyLink}</a></p>
</body></html>`;
}

const textFooter = (locale: Locale, privacyUrl: string) =>
  `${strings[locale].privacyLink}: ${privacyUrl}`;

export function confirmEmail(locale: Locale, to: string, links: Links): Email {
  const t = strings[locale];
  return {
    to,
    subject: t.confirmSubject,
    html: layout(locale, t.confirmBody, links, t.confirmCta, t.confirmNote),
    text: `${t.confirmText}\n${links.url}\n\n${t.confirmNote}\n${textFooter(locale, links.privacyUrl)}`,
  };
}

export function manageLinkEmail(locale: Locale, to: string, links: Links): Email {
  const t = strings[locale];
  return {
    to,
    subject: t.manageSubject,
    html: layout(locale, t.manageBody, links, t.manageCta, t.manageNote),
    text: `${t.manageText}\n${links.url}\n\n${t.manageNote}\n${textFooter(locale, links.privacyUrl)}`,
  };
}
