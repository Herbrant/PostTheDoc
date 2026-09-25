import { defineConfig } from "astro/config";

// Public URL of the site, path included (GitHub Pages serves project sites under /<repo>).
// With a custom domain, set SITE_URL=https://example.org.
const siteUrl = new URL(process.env.SITE_URL || "https://herbrant.github.io/PostTheDoc");

// Third parties the pages talk to: the Worker's API, Cloudflare Turnstile and Umami Cloud.
const apiOrigin = new URL(process.env.PUBLIC_API_URL || "http://localhost:8787").origin;
const TURNSTILE = "https://challenges.cloudflare.com";
// The script comes from cloud.umami.is and reports to gateway.umami.is (or a regional host).
// Umami's script comes from cloud.umami.is and reports to gateway.umami.is (or a regional host).
const UMAMI = ["https://cloud.umami.is", "https://*.umami.is", "https://*.umami.dev"];

export default defineConfig({
  site: siteUrl.origin,
  base: siteUrl.pathname,
  trailingSlash: "always",
  // The Markdown pages have no code blocks, and Shiki's inline styles would break the CSP.
  markdown: { syntaxHighlight: false },
  security: {
    // A <meta> Content-Security-Policy with the hashes of the inline scripts and styles
    // (GitHub Pages cannot send headers, so frame-ancestors is not available).
    csp: {
      directives: [
        "default-src 'self'",
        `connect-src 'self' ${apiOrigin} ${TURNSTILE} ${UMAMI.join(" ")}`,
        `frame-src ${TURNSTILE}`,
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", TURNSTILE, UMAMI[0]] },
    },
  },
});
