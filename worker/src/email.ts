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
      to: [{ email: email.to }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Brevo responded ${resp.status}: ${await resp.text()}`);
  }
}

function layout(locale: Locale, paragraph: string, url: string, cta: string, note: string): string {
  return `<!DOCTYPE html><html lang="${locale}"><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;">PostTheDoc</h1>
<p>${paragraph}</p>
<p><a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">${cta}</a></p>
<p style="font-size:13px;color:#52606d;">${note}</p>
</body></html>`;
}

export function confirmEmail(locale: Locale, to: string, url: string): Email {
  const t = strings[locale];
  return {
    to,
    subject: t.confirmSubject,
    html: layout(locale, t.confirmBody, url, t.confirmCta, t.confirmNote),
    text: `${t.confirmText}\n${url}\n\n${t.confirmNote}`,
  };
}

export function manageLinkEmail(locale: Locale, to: string, url: string): Email {
  const t = strings[locale];
  return {
    to,
    subject: t.manageSubject,
    html: layout(locale, t.manageBody, url, t.manageCta, t.manageNote),
    text: `${t.manageText}\n${url}\n\n${t.manageNote}`,
  };
}
