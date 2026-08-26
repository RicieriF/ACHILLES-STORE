import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findWorkspaceRoot } from "./index.js";

describe("Windows launcher", () => {
  it("waits for both health checks before opening store and Admin", () => {
    const launcher = readFileSync(
      join(findWorkspaceRoot(process.cwd()), "ACHILLES-STORE.bat"),
      "utf8",
    );
    const commerce = launcher.indexOf(
      'call :wait_url "http://localhost:9000/ready"',
    );
    const storefront = launcher.indexOf(
      'call :wait_url "http://localhost:3000/api/health"',
    );
    const openStore = launcher.indexOf('start "" "http://localhost:3000"');
    const openAdmin = launcher.indexOf('start "" "http://localhost:9000/app"');
    expect(commerce).toBeGreaterThan(0);
    expect(storefront).toBeGreaterThan(commerce);
    expect(openStore).toBeGreaterThan(storefront);
    expect(openAdmin).toBeGreaterThan(openStore);
    expect(launcher).toMatch(/timeout/i);
  });

  it("prepares the idempotent store structure after migrations", () => {
    const launcher = readFileSync(
      join(
        findWorkspaceRoot(process.cwd()),
        "scripts",
        "launcher",
        "achilles-launcher.ps1",
      ),
      "utf8",
    );
    expect(launcher).toMatch(/pnpm db:migrate[\s\S]*pnpm seed:production/);
    expect(launcher).toContain("Migrations e estrutura mínima");
  });
});
