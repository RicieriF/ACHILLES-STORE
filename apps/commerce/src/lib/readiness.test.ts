import { describe, expect, it, vi } from "vitest";
import { assessReadiness, requiredCommerceTables } from "./readiness";

describe("database readiness", () => {
  it("is ready only when PostgreSQL is accessible and required tables exist", async () => {
    const raw = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ result: 1 }] })
      .mockResolvedValueOnce({
        rows: requiredCommerceTables.map((table_name) => ({ table_name })),
      });

    await expect(assessReadiness({ raw })).resolves.toMatchObject({
      ready: true,
      checks: { database: "accessible", migrations: "current" },
      missingTables: [],
    });
  });

  it("returns not ready when migrations are missing", async () => {
    const raw = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ result: 1 }] })
      .mockResolvedValueOnce({ rows: [{ table_name: "supplier" }] });

    const report = await assessReadiness({ raw });
    expect(report.ready).toBe(false);
    expect(report.checks.migrations).toBe("pending_or_missing");
    expect(report.missingTables).toContain("supplier_offer");
  });

  it("returns not ready when PostgreSQL is unavailable", async () => {
    const raw = vi.fn().mockRejectedValue(new Error("connection refused"));
    await expect(assessReadiness({ raw })).resolves.toMatchObject({
      ready: false,
      checks: { database: "unavailable", migrations: "unknown" },
    });
  });
});
