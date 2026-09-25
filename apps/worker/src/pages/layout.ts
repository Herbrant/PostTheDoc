/**
 * Minimal look for the few pages rendered by the Worker; the rest of the UI lives in apps/web.
 * Colors mirror apps/web/src/styles. The theme saved by the web app lives on another origin, so
 * these pages follow the system preference.
 */
import type { Locale } from "@postthedoc/shared/contract";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { frontendUrl } from "../lib/urls";
import type { AppContext } from "../types";

const CSS = `:root{color-scheme:light dark;--paper:#f5f0e8;--ink:#16151b;--muted:#6f6865;
--violet:#5a3ee6;--on-violet:#fffdf8;--danger:#b8341a;--on-danger:#fffdf8}
@media (prefers-color-scheme:dark){:root{--paper:#111016;--ink:#f5f0e8;--muted:#b8b0ac;
--violet:#927dff;--on-violet:#111016;--danger:#ff8064;--on-danger:#111016}}
body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;color:var(--ink);
background:var(--paper);line-height:1.6}main{max-width:620px;margin:0 auto;padding:64px 20px}
h1{font:600 1.3rem Georgia,serif}h1 a{color:inherit;text-decoration:none}
h2{font-size:clamp(2.2rem,7vw,3.4rem);line-height:1;letter-spacing:-.04em;margin:48px 0 20px}
p{color:var(--muted);font-size:1.05rem}a{color:var(--violet)}
button{--accent:var(--violet);--on-accent:var(--on-violet);font:inherit;font-weight:700;
min-height:50px;padding:0 24px;border:1px solid var(--accent);border-radius:999px;
background:none;color:var(--accent);cursor:pointer}
button:hover{background:var(--accent);color:var(--on-accent)}
button.danger{--accent:var(--danger);--on-accent:var(--on-danger)}`;

type Content = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface PageOptions {
  locale: Locale;
  title: string;
  body: Content;
  status?: 200 | 400;
}

export function renderPage(c: AppContext, { locale, title, body, status = 200 }: PageOptions) {
  return c.html(
    html`<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f5f0e8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111016" media="(prefers-color-scheme: dark)">
<title>${title} · PostTheDoc</title>
<style>${raw(CSS)}</style>
</head>
<body><main><h1><a href="${frontendUrl(c, "home", locale)}">PostTheDoc</a></h1><h2>${title}</h2>${body}</main></body>
</html>`,
    status,
  );
}

/** A form that posts back to the same link: a page, not the GET itself, performs the action. */
export const confirmForm = (action: string, label: string, variant?: "danger") =>
  html`<form method="post" action="${action}"><button type="submit"${variant ? html` class="${variant}"` : ""}>${label}</button></form>`;
