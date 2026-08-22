import type { ExecArgs } from "@medusajs/framework/types";
import seedStructureAndDemo from "./seed";
import seedE2eAdmin from "./seed-e2e-admin";

export default async function seedE2e(args: ExecArgs): Promise<void> {
  process.env.SEED_DEMO_CATALOG = "true";
  process.env.APP_ENV = process.env.APP_ENV ?? "test";
  await seedStructureAndDemo(args);
  await seedE2eAdmin(args);
}
