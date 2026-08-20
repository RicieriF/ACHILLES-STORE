import { describe, expect, it, vi, beforeEach } from "vitest";
import type SupplierDomainModuleService from "../../../../modules/supplier-domain/service";
import { createOrReuseDraft } from "./importer";
import { createImportInput, updateImportInput } from "./schemas";
import {
  IMPORT_COOLDOWN_MS,
  ImportRateLimitError,
  resetImportLimits,
  withImportLock,
} from "./rate-limit";
import { assertDraftTransition } from "./transitions";

describe("admin import domain", () => {
  beforeEach(() => {
    resetImportLimits();
    process.env.ALIBABA_PRODUCT_IMPORT = "false";
  });
  it("validates create/edit payloads and decimal prices", () => {
    expect(
      createImportInput.safeParse({
        source_url: "https://www.alibaba.com/x/test",
      }).success,
    ).toBe(true);
    expect(createImportInput.safeParse({ source_url: "not-url" }).success).toBe(
      false,
    );
    expect(
      updateImportInput.safeParse({ source_price_min: "12.50", moq: 2 })
        .success,
    ).toBe(true);
    expect(
      updateImportInput.safeParse({ source_price_min: "12,50", moq: 0 })
        .success,
    ).toBe(false);
  });
  it("creates a manual review draft when the feature is off and records attempt/audit", async () => {
    const draft = {
      id: "impdraft_1",
      canonical_source_url:
        "https://www.alibaba.com/product-detail/Test_1600123456789.html",
      status: "NEEDS_REVIEW",
    };
    const service = {
      listImportDrafts: vi.fn().mockResolvedValue([]),
      createImportDrafts: vi.fn().mockResolvedValue(draft),
      createImportAttempts: vi.fn().mockResolvedValue({}),
      createAuditEvents: vi.fn().mockResolvedValue({}),
    } as unknown as SupplierDomainModuleService;
    await expect(
      createOrReuseDraft(
        service,
        "https://www.alibaba.com/product-detail/Test_1600123456789.html",
        "user_1",
      ),
    ).resolves.toEqual({ draft, reused: false });
    expect(service.createImportDrafts).toHaveBeenCalledOnce();
    expect(service.createImportAttempts).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "MANUAL_REVIEW",
        error_code: "FEATURE_DISABLED",
      }),
    );
    expect(service.createAuditEvents).toHaveBeenCalledOnce();
  });
  it("deduplicates an active canonical URL", async () => {
    const draft = { id: "impdraft_existing" };
    const service = {
      listImportDrafts: vi.fn().mockResolvedValue([draft]),
    } as unknown as SupplierDomainModuleService;
    await expect(
      createOrReuseDraft(
        service,
        "https://www.alibaba.com/product-detail/Test_1600123456789.html",
        null,
      ),
    ).resolves.toEqual({ draft, reused: true });
  });
  it("locks concurrent work and applies cooldown", async () => {
    let release: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = withImportLock("url", async () => {
      await waiting;
      return "ok";
    });
    await expect(
      withImportLock("url", () => Promise.resolve("duplicate")),
    ).rejects.toBeInstanceOf(ImportRateLimitError);
    release?.();
    await expect(first).resolves.toBe("ok");
    await expect(
      withImportLock("url", () => Promise.resolve("cooldown")),
    ).rejects.toBeInstanceOf(ImportRateLimitError);
    expect(IMPORT_COOLDOWN_MS).toBe(15_000);
  });
  it("enforces terminal, incomplete and compliance-blocked transitions", () => {
    expect(() => {
      assertDraftTransition("NEEDS_REVIEW", "APPROVED", {
        complianceStatus: "CLEAR",
        title: "Lanterna",
      });
    }).not.toThrow();
    expect(() => {
      assertDraftTransition("APPROVED", "REJECTED", {
        complianceStatus: "CLEAR",
        title: "x",
      });
    }).toThrow("finalizado");
    expect(() => {
      assertDraftTransition("NEEDS_REVIEW", "APPROVED", {
        complianceStatus: "CLEAR",
        title: "",
      });
    }).toThrow("Título");
    expect(() => {
      assertDraftTransition("NEEDS_REVIEW", "APPROVED", {
        complianceStatus: "BLOCKED",
        title: "Item",
      });
    }).toThrow("bloqueado");
  });
});
