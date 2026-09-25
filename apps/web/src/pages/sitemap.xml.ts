// The public pages in every language, each with its translations. The manage page is left out:
// without the link from an email it only asks for one.
import type { APIRoute } from "astro";
import { LOCALES, type Locale } from "../i18n";
import { absolute, href } from "../lib/urls";

const PAGES = ["", "subscribe/", "philosophy/", "privacy/"];

export const GET: APIRoute = ({ site }) => {
  const url = (lang: Locale, page: string) => absolute(href(lang, page), site);
  const entries = PAGES.flatMap((page) =>
    LOCALES.map((lang) => {
      const alternates = LOCALES.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(l, page)}"/>`,
      );
      return `  <url>\n    <loc>${url(lang, page)}</loc>\n${alternates.join("\n")}\n  </url>`;
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
