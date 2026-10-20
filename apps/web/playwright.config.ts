import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "pnpm build && pnpm start -p 3100",
    url: "http://localhost:3100",
    timeout: 300_000,
    reuseExistingServer: false,
    // Force the seeded in-memory store regardless of .env.local.
    env: { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", ANTHROPIC_API_KEY: "" },
  },
});
