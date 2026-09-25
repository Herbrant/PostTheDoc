// Everything may be crawled; the sitemap lists the pages worth indexing.
import type { APIRoute } from "astro";
import { absolute, asset } from "../lib/urls";

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absolute(asset("sitemap.xml"), site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
