/** The two emails the Worker sends: subscription confirmation and manage link. */
import type { Locale } from "@postthedoc/shared/contract";
import { html } from "hono/html";
import { strings } from "../i18n";
import type { Email } from "./brevo";

export interface EmailLinks {
  /** The call to action. */
  url: string;
  privacyUrl: string;
}

interface Content {
  subject: string;
  body: string;
  cta: string;
  note: string;
  text: string;
}

function build(locale: Locale, to: string, content: Content, links: EmailLinks): Email {
  const t = strings[locale];
  const muted = "font-size:13px;color:#52606d;";
  const body = html`<!DOCTYPE html><html lang="${locale}"><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;">PostTheDoc</h1>
<p>${content.body}</p>
<p><a href="${links.url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">${content.cta}</a></p>
<p style="${muted}">${content.note}</p>
<p style="${muted}"><a href="${links.privacyUrl}" style="color:#52606d;">${t.privacyLink}</a></p>
</body></html>`;
  return {
    to,
    subject: content.subject,
    html: body.toString(),
    text: `${content.text}\n${links.url}\n\n${content.note}\n${t.privacyLink}: ${links.privacyUrl}`,
  };
}

export function confirmationEmail(locale: Locale, to: string, links: EmailLinks): Email {
  const t = strings[locale];
  const content = {
    subject: t.confirmSubject,
    body: t.confirmBody,
    cta: t.confirmCta,
    note: t.confirmNote,
    text: t.confirmText,
  };
  return build(locale, to, content, links);
}

export function manageLinkEmail(locale: Locale, to: string, links: EmailLinks): Email {
  const t = strings[locale];
  const content = {
    subject: t.manageSubject,
    body: t.manageBody,
    cta: t.manageCta,
    note: t.manageNote,
    text: t.manageText,
  };
  return build(locale, to, content, links);
}
