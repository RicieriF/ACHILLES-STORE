import { defineConfig, devices } from "@playwright/test";

const e2eEnvironment = {
  PAYMENT_TEST_PROVIDER_ENABLED: "true",
  PAYMENT_TEST_WEBHOOK_SECRET: "playwright_test_webhook_secret_only",
  E2E_ADMIN_PASSWORD: "E2eOnly_012_Strong",
};
Object.assign(process.env, e2eEnvironment);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: [
    {
      command: "pnpm --filter @achilles/commerce start:e2e",
      url: "http://localhost:9000/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        ...process.env,
        ...e2eEnvironment,
      },
    },
    {
      command: "pnpm --filter @achilles/storefront start",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
