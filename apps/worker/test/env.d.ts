declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[]; // set in vitest.config.ts
  }
  interface GlobalProps {
    mainModule: typeof import("../src/index");
  }
}
