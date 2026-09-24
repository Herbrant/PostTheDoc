declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FRONTEND_URL: string;
    SENDER_EMAIL: string;
    SENDER_NAME: string;
    EMAIL_MODE: "brevo" | "log";
    TOKEN_SECRET: string;
    BREVO_API_KEY: string;
    TURNSTILE_SECRET: string;
  }
}

type Env = Cloudflare.Env;
