import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const targetRoot = resolve(".next/standalone/apps/simple-admin");
const copies = [
  [resolve(".next/static"), resolve(targetRoot, ".next/static")],
  [resolve("public"), resolve(targetRoot, "public")],
];

for (const [source, target] of copies) {
  if (!existsSync(source)) continue;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}
