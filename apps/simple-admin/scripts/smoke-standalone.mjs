import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const port = 3101;
const healthUrl = `http://127.0.0.1:${port}/api/health`;
const serverPath = resolve(".next/standalone/apps/simple-admin/server.js");
const standaloneRequire = createRequire(serverPath);

const nextPackage = standaloneRequire.resolve("next/package.json");
createRequire(nextPackage).resolve(
  "@swc/helpers/esm/_interop_require_default.js",
);

const child = spawn(process.execPath, [resolve("scripts/start.mjs")], {
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

const deadline = Date.now() + 60_000;
let healthy = false;
try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Standalone exited before readiness (code ${child.exitCode}).\n${output}`,
      );
    }
    try {
      const response = await fetch(healthUrl);
      if (response.status === 200) {
        healthy = true;
        break;
      }
    } catch {
      // The socket is expected to be unavailable while Next initializes.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  if (!healthy) {
    throw new Error(`Standalone health check timed out.\n${output}`);
  }
  console.log(`Standalone smoke passed: ${healthUrl} returned HTTP 200.`);
} finally {
  if (child.exitCode === null) child.kill();
}
