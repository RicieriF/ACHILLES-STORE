import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const markerPath = "artifacts/task-016-2/run-marker.txt";

test("operator database does not keep this E2E run", () => {
  test.skip(!existsSync(markerPath), "Marcador da corrida operacional ausente");
  const marker = readFileSync(markerPath, "utf8").trim();
  expect(marker.length).toBeGreaterThan(5);
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/ensure-e2e-database.cts",
      "--operator-title-count",
      marker,
    ],
    { encoding: "utf8", env: process.env },
  );
  expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
  expect(result.stdout.trim().split(/\r?\n/).at(-1)).toBe("0");
});
