/** The emails the Worker sends: subscription confirmation, welcome and manage link. */
import type { Preferences } from "@postthedoc/shared/api";
import { DONATE_URL, ISSUES_URL, type Locale } from "@postthedoc/shared/contract";
import { institutions, regions, roles, sectors } from "@postthedoc/shared/reference";
import { html } from "hono/html";
import { strings } from "../i18n";
import type { Email } from "./brevo";

export interface EmailLinks {
  /** The call to action. */
  url: string;
  privacyUrl: string;
  unsubscribeUrl?: string;
}

type Html = ReturnType<typeof html>;

interface Content {
  subject: string;
  /** Headline above the body, marked with the digest's accent dot. */
  lead?: string;
  body: string;
  /** Shown between the body and the call to action. */
  details?: { html: Html; text: string };
  cta: string;
  note: string;
  text: string;
  /** Ask for a donation after the note: only where it is not a pure transactional email. */
  donate?: boolean;
}

/** Light theme of apps/web/src/styles/tokens.css; emails only get inline styles. */
const C = {
  paper: "#f5f0e8",
  card: "#fffdf8",
  line: "#d6d1cb",
  ink: "#16151b",
  muted: "#6f6865",
  accent: "#ff6542",
};
const SANS = "'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

/** The donation box, as in the daily digest (apps/pipeline/.../templates/_macros.j2). */
function donateBox(locale: Locale): Html {
  const t = strings[locale];
  return html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:${C.paper};border:1px solid ${C.line};border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:${C.ink};">${t.donateText}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${C.accent};border-radius:999px;"><a href="${DONATE_URL}" style="display:inline-block;padding:10px 20px;color:${C.ink};font-size:15px;font-weight:700;text-decoration:none;">&#9749;&nbsp; ${t.donateCta}</a></td>
        </tr></table>
      </td></tr>
    </table>`;
}

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
    ${content.lead ? html`<p style="margin:0 0 12px;font:600 22px/1.3 ${SERIF};letter-spacing:-0.01em;"><span style="color:${C.accent};">&#9679;</span>&nbsp; ${content.lead}</p>` : ""}<p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${content.body}</p>${content.details?.html ?? ""}
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${C.ink};border-radius:999px;"><a href="${links.url}" style="display:inline-block;padding:12px 22px;color:${C.card};font-size:15px;font-weight:700;text-decoration:none;">${content.cta}</a></td>
    </tr></table>
    <p style="${muted}margin-top:24px;">${content.note}</p>${content.donate ? donateBox(locale) : ""}
    <p style="${muted}">${t.noReply} <a href="${ISSUES_URL}" style="color:${C.muted};">${t.issuesLink}</a></p>
    <p style="${muted}"><a href="${links.privacyUrl}" style="color:${C.muted};">${t.privacyLink}</a>${links.unsubscribeUrl ? html` · <a href="${links.unsubscribeUrl}" style="color:${C.muted};">${t.unsubscribeLink}</a>` : ""}</p>
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
    text: [
      ...(content.lead ? [content.lead, content.body, ""] : []),
      ...(content.details ? [content.details.text, ""] : []),
      content.text,
      links.url,
      "",
      content.note,
      ...(content.donate ? ["", t.donateText, `\u2615 ${t.donateCta}: ${DONATE_URL}`, ""] : []),
      t.noReply,
      `${t.issuesLink}: ${ISSUES_URL}`,
      `${t.privacyLink}: ${links.privacyUrl}`,
      ...(links.unsubscribeUrl ? [`${t.unsubscribeLink}: ${links.unsubscribeUrl}`] : []),
    ].join("\n"),
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

/** The preferences as labelled lists of names, in the order of the reference tables. */
function preferenceRows(locale: Locale, prefs: Preferences): [string, string[]][] {
  const t = strings[locale];
  const picked = <T extends { code: string }>(items: readonly T[], codes: string[]) => {
    const chosen = new Set(codes);
    return items.filter((item) => chosen.has(item.code));
  };
  const sectorItems = picked(sectors.groups, prefs.sectors).map((g) => `${g.code} ${g.name}`);
  if (prefs.include_unspecified && sectorItems.length) sectorItems.push(t.prefUnspecified);
  const places = [
    ...picked(regions, prefs.regions).map((r) => r.name[locale]),
    ...picked(institutions, prefs.institutions).map((i) => i.name),
  ];
  const rows: [string, string[]][] = [
    [t.prefRoles, picked(roles, prefs.roles).map((r) => r.name[locale])],
    [t.prefSectors, sectorItems],
    [t.prefLocation, places.length ? places : [t.prefAllItaly]],
  ];
  return rows.filter(([, items]) => items.length > 0);
}

function preferencesBox(locale: Locale, prefs: Preferences): { html: Html; text: string } {
  const t = strings[locale];
  const rows = preferenceRows(locale, prefs);
  const label = `font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};`;
  return {
    html: html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:${C.paper};border:1px solid ${C.line};border-radius:12px;">
      <tr><td style="padding:18px 20px 6px;">
        <div style="margin:0 0 12px;font:600 16px/1.3 ${SERIF};color:${C.ink};">${t.welcomePrefsTitle}</div>
        ${rows.map(
          ([name, items]) =>
            html`<div style="margin:0 0 12px;"><div style="${label}">${name}</div><div style="margin-top:3px;font-size:15px;line-height:1.5;">${items.map((item, i) => html`${i ? html`<br>` : ""}${item}`)}</div></div>`,
        )}
      </td></tr>
    </table>`,
    text: [
      t.welcomePrefsTitle,
      ...rows.map(([name, items]) => `${name}: ${items.join("; ")}`),
    ].join("\n"),
  };
}

export function welcomeEmail(
  locale: Locale,
  to: string,
  prefs: Preferences,
  links: EmailLinks,
): Email {
  const t = strings[locale];
  const content = {
    subject: t.welcomeSubject,
    lead: t.welcomeLead,
    body: t.welcomeBody,
    details: preferencesBox(locale, prefs),
    cta: t.welcomeCta,
    note: t.welcomeNote,
    text: t.welcomeText,
    donate: true,
  };
  return build(locale, to, content, links);
}
