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

/** Light theme of apps/web/src/styles/tokens.css; emails only get inline styles. */
const C = {
  paper: "#f5f0e8",
  card: "#fffdf8",
  line: "#d6d1cb",
  ink: "#16151b",
  muted: "#6f6865",
};
const SANS = "'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function build(locale: Locale, to: string, content: Content, links: EmailLinks): Email {
  const t = strings[locale];
  const muted = `margin:16px 0 0;font-size:13px;line-height:1.5;color:${C.muted};`;
  const body = html`<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};font-family:${SANS};color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:16px;">
  <tr><td style="padding:28px 32px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:${C.ink};border-radius:50% 50% 50% 14%;color:${C.card};font:600 20px/36px ${SERIF};">P</td>
      <td style="padding-left:12px;">
        <div style="font:600 20px/1.1 ${SERIF};letter-spacing:-0.02em;color:${C.ink};">PostTheDoc</div>
        <div style="margin-top:3px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">${t.brandTagline}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px 32px;">
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${content.body}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${C.ink};border-radius:999px;"><a href="${links.url}" style="display:inline-block;padding:12px 22px;color:${C.card};font-size:15px;font-weight:700;text-decoration:none;">${content.cta}</a></td>
    </tr></table>
    <p style="${muted}margin-top:24px;">${content.note}</p>
    <p style="${muted}"><a href="${links.privacyUrl}" style="color:${C.muted};">${t.privacyLink}</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
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
