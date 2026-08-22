import type { ExecArgs } from "@medusajs/framework/types";
import seedStructureAndDemo from "./seed";
import seedE2eAdmin from "./seed-e2e-admin";

export default async function seedE2e(args: ExecArgs): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.includes("/achilles_store_e2e")) {
    throw new Error("E2E aborted: DATABASE_URL must use /achilles_store_e2e");
  }
  process.env.SEED_DEMO_CATALOG = "true";
  process.env.APP_ENV = process.env.APP_ENV ?? "test";
  await seedStructureAndDemo(args);
  await seedE2eAdmin(args);
}
