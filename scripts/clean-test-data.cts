const { spawnSync } =
  require("node:child_process") as typeof import("node:child_process");

const unsupported = process.argv
  .slice(2)
  .filter((argument) => argument !== "--dry-run");
if (unsupported.length > 0) {
  console.error(`Unsupported cleanup argument(s): ${unsupported.join(", ")}`);
  process.exit(2);
}

const dryRun = process.argv.includes("--dry-run");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  [
    "--filter",
    "@achilles/commerce",
    "exec",
    "medusa",
    "exec",
    "./src/scripts/clean-test-data.ts",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CLEAN_TEST_DATA_DRY_RUN: dryRun ? "true" : "false",
    },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
