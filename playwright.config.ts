import { defineConfig, devices } from "@playwright/test";
import {
  assertE2eDatabaseUrl,
  resolveE2eDatabaseUrl,
  resolveOperatorDatabaseUrl,
} from "./scripts/e2e-database-url";

const operatorDatabaseUrl = resolveOperatorDatabaseUrl(process.env);
const e2eDatabaseUrl = resolveE2eDatabaseUrl({
  ...process.env,
  OPERATOR_DATABASE_URL: operatorDatabaseUrl,
  DATABASE_URL: operatorDatabaseUrl,
});
assertE2eDatabaseUrl(e2eDatabaseUrl);

const e2eEnvironment = {
  APP_ENV: "test",
  DATABASE_URL: e2eDatabaseUrl,
  E2E_DATABASE_URL: e2eDatabaseUrl,
  OPERATOR_DATABASE_URL: operatorDatabaseUrl,
  PUBLIC_BASE_URL: "http://localhost:9000",
  STOREFRONT_BASE_URL: "http://localhost:3000",
  PAYMENT_TEST_PROVIDER_ENABLED: "true",
  PAYMENT_TEST_WEBHOOK_SECRET: "playwright_test_webhook_secret_only",
  E2E_ADMIN_PASSWORD: "E2eOnly_012_Strong",
  SEED_DEMO_CATALOG: "true",
  CJ_ENABLED: "true",
  CJ_PRODUCT_IMPORT: "true",
  CJ_STOCK: "true",
  CJ_SHIPPING: "true",
  CJ_TRACKING: "true",
  CJ_ORDER_CREATE: "false",
  CJ_ORDER_PAY: "false",
  CJ_TEST_MODE: "true",
  CJ_API_KEY: "e2e-fixture-only",
  CJ_BASE_URL: "https://fixture.invalid",
  ALIBABA_ENABLED: "true",
  ALIBABA_PRODUCT_IMPORT: "true",
  ALIBABA_FREIGHT_QUOTE: "true",
  ALIBABA_TRACKING: "true",
  ALIBABA_TEST_MODE: "true",
  ALIBABA_APP_KEY: "e2e-fixture-app-key",
  ALIBABA_APP_SECRET: "e2e-fixture-app-secret",
  ALIBABA_ACCESS_TOKEN: "e2e-fixture-access-token",
  ALIBABA_HEALTHCHECK_PRODUCT_ID: "123456",
  ALIBABA_ORDER_CREATE: "false",
  ALIBABA_ORDER_PAY: "false",
};
const reuseE2eServers =
  process.env.E2E_REUSE_SERVERS === "true" &&
  (process.env.DATABASE_URL ?? e2eDatabaseUrl).includes("achilles_store_e2e");
Object.assign(process.env, e2eEnvironment);
assertE2eDatabaseUrl(process.env.DATABASE_URL ?? "");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "html",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: [
    {
      command:
        "node --experimental-strip-types ./scripts/ensure-e2e-database.cts && pnpm --filter @achilles/commerce db:migrate && pnpm --filter @achilles/commerce start:e2e",
      url: "http://localhost:9000/ready",
      reuseExistingServer: reuseE2eServers,
      timeout: 300_000,
      env: {
        ...process.env,
        ...e2eEnvironment,
      },
    },
    {
      command: "pnpm --filter @achilles/storefront start",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: reuseE2eServers,
      timeout: 120_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
