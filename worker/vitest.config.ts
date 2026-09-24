import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Explicit values so that a local .dev.vars does not change test behavior.
          bindings: {
            EMAIL_MODE: "brevo",
            FRONTEND_URL: "https://front.test/app",
            SENDER_EMAIL: "sender@front.test",
            TEST_MIGRATIONS: migrations,
            TOKEN_SECRET: "test-secret",
            BREVO_API_KEY: "test-brevo-key",
            TURNSTILE_SECRET: "test-turnstile-secret",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
