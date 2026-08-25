import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const targetRoot = resolve(".next/standalone/apps/simple-admin");
const tracedRoot = resolve(".next/standalone-next-output");
const workspaceRoot = resolve("../..");

if (!existsSync(targetRoot)) {
  throw new Error(`Next standalone output not found: ${targetRoot}`);
}

rmSync(tracedRoot, { recursive: true, force: true });
renameSync(targetRoot, tracedRoot);

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error(
    "pnpm CLI path is unavailable; run this script via pnpm build",
  );
}
execFileSync(
  process.execPath,
  [
    pnpmCli,
    "--config.inject-workspace-packages=true",
    "--filter",
    "@achilles/simple-admin",
    "deploy",
    "--prod",
    targetRoot,
  ],
  {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: { ...process.env, CI: process.env.CI ?? "true" },
  },
);

for (const entry of readdirSync(targetRoot, { withFileTypes: true })) {
  if (entry.name === "node_modules") continue;
  rmSync(resolve(targetRoot, entry.name), {
    recursive: entry.isDirectory(),
    force: true,
  });
}

for (const entry of readdirSync(tracedRoot, { withFileTypes: true })) {
  if (entry.name === "node_modules") continue;
  cpSync(resolve(tracedRoot, entry.name), resolve(targetRoot, entry.name), {
    recursive: entry.isDirectory(),
    force: true,
  });
}
rmSync(tracedRoot, { recursive: true, force: true });

const copies = [
  [resolve(".next/static"), resolve(targetRoot, ".next/static")],
  [resolve("public"), resolve(targetRoot, "public")],
];

for (const [source, target] of copies) {
  if (!existsSync(source)) continue;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}
