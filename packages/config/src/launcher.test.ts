import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findWorkspaceRoot } from "./index.js";

describe("Windows launcher", () => {
  const root = findWorkspaceRoot(process.cwd());
  const batch = () => readFileSync(join(root, "ACHILLES_STORE.bat"), "utf8");
  const powershell = () =>
    readFileSync(
      join(root, "scripts", "launcher", "achilles-launcher.ps1"),
      "utf8",
    );

  it("offers one human entrypoint and routes every supported argument", () => {
    const launcher = batch();
    expect(
      readdirSync(root).filter((name) => name.toLowerCase().endsWith(".bat")),
    ).toEqual(["ACHILLES_STORE.bat"]);
    for (const argument of [
      "--start",
      "--stop",
      "--restart",
      "--status",
      "--update",
      "--setup",
      "--debug",
    ]) {
      expect(launcher).toContain(`"${argument}"`);
    }
    expect(launcher).toContain("-Action %ACTION% %EXTRA%");
    expect(launcher).toMatch(/:START_SILENT[\s\S]*-NoOpen/);
  });

  it("preserves health, recovery and idempotent structure protections", () => {
    const launcher = powershell();
    expect(launcher).toMatch(/pnpm db:migrate[\s\S]*pnpm seed:production/);
    expect(launcher).toContain("Migrations e estrutura mínima");
    expect(launcher).toMatch(/StatusCode -ge 200 -and \$r\.StatusCode -lt 300/);
    expect(launcher).toContain("achilles_store_e2e");
    expect(launcher).toContain("não pertence ao launcher Achilles");
    expect(launcher).toContain("está ocupada por outro aplicativo");
    expect(launcher).toMatch(/Test-PostgresContainer[\s\S]*Health\.Status/);
  });

  it("uses the unified entrypoint for one shortcut and non-interactive autostart", () => {
    const launcher = powershell();
    expect(launcher).toContain('"ACHILLES_STORE.bat"');
    expect(launcher).toContain("--start");
    expect(launcher).toContain('"ACHILLES STORE.lnk"');
    expect(launcher).not.toContain("START_ACHILLES.bat");
    expect(launcher.match(/CreateShortcut/g)).toHaveLength(1);
  });
});
