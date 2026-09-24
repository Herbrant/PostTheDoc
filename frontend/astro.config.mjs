import { defineConfig } from "astro/config";

// Public URL of the site, path included (GitHub Pages serves project sites under /<repo>).
// With a custom domain, set SITE_URL=https://example.org.
const siteUrl = new URL(process.env.SITE_URL || "https://herbrant.github.io/PostTheDoc");

export default defineConfig({
  site: siteUrl.origin,
  base: siteUrl.pathname,
  trailingSlash: "always",
});
