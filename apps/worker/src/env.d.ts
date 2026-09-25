declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** "development" relaxes the captcha checks for Cloudflare's test keys. */
    ENVIRONMENT: "production" | "development";
    /** Public URL of the web app: allowed CORS origin and target of the links in the emails. */
    FRONTEND_URL: string;
    SENDER_EMAIL: string;
    SENDER_NAME: string;
    /** "brevo" really sends emails, "log" prints them (local development). */
    EMAIL_MODE: "brevo" | "log";
    TOKEN_SECRET: string;
    /** The TOKEN_SECRET before the last rotation: still verifies unsubscribe links. */
    TOKEN_SECRET_PREVIOUS?: string;
    BREVO_API_KEY: string;
    TURNSTILE_SECRET: string;
    /** Per-IP limit of the endpoints that send emails (wrangler.jsonc). */
    EMAIL_RATE_LIMITER: RateLimit;
  }
}

type Env = Cloudflare.Env;
