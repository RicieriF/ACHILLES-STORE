import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const markerPath = "artifacts/task-016-2/run-marker.txt";

test("operator database does not keep this E2E run", () => {
  test.skip(!existsSync(markerPath), "Marcador da corrida operacional ausente");
  const marker = readFileSync(markerPath, "utf8").trim();
  expect(marker.length).toBeGreaterThan(5);
  const result = spawnSync(
    `docker compose exec -T postgres psql -U achilles -d achilles_store -tAc "select count(*) from product where deleted_at is null and title like '%${marker}%'"`,
    { encoding: "utf8", shell: true },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("0");
});
