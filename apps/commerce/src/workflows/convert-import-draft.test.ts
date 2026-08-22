import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";

const workflowMocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  deleteRun: vi.fn(),
}));
vi.mock("@medusajs/medusa/core-flows", () => ({
  createProductsWorkflow: () => ({ run: workflowMocks.createRun }),
  deleteProductsWorkflow: () => ({ run: workflowMocks.deleteRun }),
}));
import {
  buildProductVariants,
  convertImportDraft,
  ImportConversionError,
  validateConvertibleDraft,
} from "./convert-import-draft";

const draft = {
  id: "impdraft_1",
  provider: "ALIBABA",
  source_url: "https://www.alibaba.com/product-detail/Test_1600123456789.html",
  canonical_source_url:
    "https://www.alibaba.com/product-detail/Test_1600123456789.html",
  supplier_product_id: "1600123456789",
  status: "APPROVED",
  title_normalized: "[FICTÍCIO] Lanterna",
  description_normalized: "Produto de teste",
  source_currency: "USD",
  source_price_min: "8.40",
  source_price_max: "9.10",
  moq: 10,
  category_suggested: "Iluminação",
  media: { items: [] },
  specifications: { Peso: "250 g" },
  variants: {
    items: [
      {
        supplierSku: "SOURCE-RED",
        title: "Vermelha",
        attributes: { Cor: "Vermelha" },
      },
    ],
  },
  compliance_status: "CLEAR",
  last_fetch_at: null,
  converted_product_id: null,
};

function setup(overrides: Record<string, unknown> = {}) {
  const service = {
    retrieveImportDraft: vi.fn().mockResolvedValue({ ...draft, ...overrides }),
    listSupplierOffers: vi.fn().mockResolvedValue([]),
    updateImportDrafts: vi
      .fn()
      .mockImplementation((value) => Promise.resolve(value)),
    createAuditEvents: vi.fn().mockResolvedValue({}),
    listSuppliers: vi
      .fn()
      .mockResolvedValue([{ id: "sup_1", name: "pending" }]),
    createSuppliers: vi.fn().mockResolvedValue({ id: "sup_new" }),
    createSupplierOffers: vi.fn().mockResolvedValue({ id: "offer_1" }),
    createSupplierVariantMaps: vi.fn().mockResolvedValue({ id: "map_1" }),
    createCostQuotes: vi.fn().mockResolvedValue({ id: "cost_1" }),
    createProductPolicies: vi.fn().mockResolvedValue({
      id: "policy_1",
      commercial_readiness: "PRICING_REQUIRED",
      compliance_status: overrides.compliance_status ?? "CLEAR",
    }),
    listCostQuotes: vi.fn(),
    listProductPolicies: vi.fn(),
    listSupplierVariantMaps: vi.fn().mockResolvedValue([]),
    deleteProductPolicies: vi.fn().mockResolvedValue(undefined),
    deleteCostQuotes: vi.fn().mockResolvedValue(undefined),
    deleteSupplierVariantMaps: vi.fn().mockResolvedValue(undefined),
    deleteSupplierOffers: vi.fn().mockResolvedValue(undefined),
    deleteSuppliers: vi.fn().mockResolvedValue(undefined),
  };
  const fulfillment = {
    listShippingProfiles: vi
      .fn()
      .mockResolvedValue([{ id: "sp_1", type: "default" }]),
  };
  const products = {
    listProductCategories: vi
      .fn()
      .mockResolvedValue([{ id: "pcat_1", name: "Iluminação" }]),
  };
  const container = {
    resolve: vi.fn((key: unknown) =>
      key === SUPPLIER_DOMAIN_MODULE
        ? service
        : key === Modules.FULFILLMENT
          ? fulfillment
          : products,
    ),
  } as unknown as MedusaContainer;
  workflowMocks.createRun.mockResolvedValue({
    result: [
      {
        id: "prod_1",
        status: ProductStatus.DRAFT,
        variants: [{ id: "pvar_1" }],
      },
    ],
  });
  workflowMocks.deleteRun.mockResolvedValue({});
  return { service, container };
}

describe("ImportDraft conversion", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["NEEDS_REVIEW", "REJECTED", "FAILED"])(
    "rejects %s drafts",
    (status) => {
      expect(() => {
        validateConvertibleDraft({ ...draft, status });
      }).toThrow(ImportConversionError);
    },
  );
  it("rejects blocked and incomplete drafts", () => {
    expect(() => {
      validateConvertibleDraft({ ...draft, compliance_status: "BLOCKED" });
    }).toThrow("bloqueado");
    expect(() => {
      validateConvertibleDraft({ ...draft, title_normalized: null });
    }).toThrow("obrigatórios");
  });
  it("creates a DRAFT product without sales channels or retail prices", async () => {
    const { service, container } = setup();
    const result = await convertImportDraft(container, draft.id, "user_1");
    const payload = workflowMocks.createRun.mock.calls[0]?.[0] as
      | {
          input: {
            products: Array<{
              status: string;
              sales_channels: unknown[];
              metadata: Record<string, unknown>;
              variants: Array<{ prices: unknown[] }>;
            }>;
          };
        }
      | undefined;
    const productInput = payload?.input.products[0];
    expect(productInput).toMatchObject({
      status: ProductStatus.DRAFT,
      sales_channels: [],
      metadata: { achilles_import_draft_id: draft.id },
    });
    expect(productInput?.variants[0]?.prices).toEqual([]);
    expect(service.createSupplierOffers).toHaveBeenCalledWith(
      expect.objectContaining({
        import_draft_id: draft.id,
        is_primary: true,
        private_label_supported: false,
        status: "ACTIVE",
      }),
    );
    expect(service.createCostQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "INCOMPLETE",
        supplier_unit_cost: "8.40",
        fx_rate: null,
        international_freight: null,
      }),
    );
    expect(service.createProductPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        compliance_status: "CLEAR",
        commercial_readiness: "PRICING_REQUIRED",
      }),
    );
    expect(result).toMatchObject({ product_id: "prod_1", idempotent: false });
    expect(service.createAuditEvents.mock.calls.length).toBeGreaterThanOrEqual(
      6,
    );
  });
  it("preserves supplier variant provenance without creating final SKU", async () => {
    const { service, container } = setup();
    await convertImportDraft(container, draft.id, null);
    expect(service.createSupplierVariantMaps).toHaveBeenCalledWith(
      expect.objectContaining({
        store_variant_id: "pvar_1",
        supplier_sku: "SOURCE-RED",
        attributes: { Cor: "Vermelha" },
      }),
    );
  });
  it("creates a clearly pending supplier only when reuse is impossible", async () => {
    const { service, container } = setup();
    service.listSuppliers.mockResolvedValue([]);
    await convertImportDraft(container, draft.id, null);
    expect(service.createSuppliers).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "INACTIVE",
        metadata: { resolution: "MANUAL_PENDING" },
      }),
    );
  });
  it("reuses an existing supplier", async () => {
    const { service, container } = setup();
    await convertImportDraft(container, draft.id, null);
    expect(service.createSuppliers).not.toHaveBeenCalled();
    expect(service.createSupplierOffers).toHaveBeenCalledWith(
      expect.objectContaining({ supplier_id: "sup_1" }),
    );
  });
  it("returns an existing complete conversion idempotently", async () => {
    const { service, container } = setup({
      converted_product_id: "prod_existing",
    });
    service.listSupplierOffers.mockResolvedValue([
      {
        id: "offer_existing",
        product_id: "prod_existing",
        supplier_id: "sup_1",
      },
    ]);
    service.listCostQuotes.mockResolvedValue([{ id: "cost_existing" }]);
    service.listProductPolicies.mockResolvedValue([
      {
        id: "policy_existing",
        commercial_readiness: "PRICING_REQUIRED",
        compliance_status: "CLEAR",
      },
    ]);
    await expect(
      convertImportDraft(container, draft.id, null),
    ).resolves.toMatchObject({ product_id: "prod_existing", idempotent: true });
    expect(workflowMocks.createRun).not.toHaveBeenCalled();
  });
  it("rolls back product, offer and new supplier when a later step fails", async () => {
    const { service, container } = setup();
    service.listSuppliers.mockResolvedValue([]);
    service.createCostQuotes.mockRejectedValue(new Error("cost failed"));
    await expect(
      convertImportDraft(container, draft.id, null),
    ).rejects.toMatchObject({ code: "TRANSACTION_ROLLED_BACK" });
    expect(service.deleteSupplierOffers).toHaveBeenCalledWith("offer_1");
    expect(service.deleteSuppliers).toHaveBeenCalledWith("sup_new");
    expect(workflowMocks.deleteRun).toHaveBeenCalledWith({
      input: { ids: ["prod_1"] },
    });
  });
  it("creates a minimal technical variant when source variants are absent", () => {
    const result = buildProductVariants({ items: [] });
    expect(result.variants).toHaveLength(1);
    expect(result.source[0]).toMatchObject({
      supplierSku: "",
      title: "Padrão",
    });
  });
  it("propagates review-required compliance to commercial readiness", async () => {
    const { service, container } = setup({
      compliance_status: "REVIEW_REQUIRED",
    });
    await convertImportDraft(container, draft.id, null);
    expect(service.createProductPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        sensitivity: "EDGED_TOOL",
        commercial_readiness: "COMPLIANCE_REQUIRED",
      }),
    );
  });
  it("rejects a concurrent conversion of the same draft", async () => {
    const { container } = setup();
    let release: ((value: unknown) => void) | undefined;
    workflowMocks.createRun.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = convertImportDraft(container, draft.id, null);
    await vi.waitFor(() => {
      expect(workflowMocks.createRun).toHaveBeenCalledOnce();
    });
    await expect(
      convertImportDraft(container, draft.id, null),
    ).rejects.toMatchObject({ code: "CONVERSION_IN_PROGRESS" });
    release?.({
      result: [
        {
          id: "prod_1",
          status: ProductStatus.DRAFT,
          variants: [{ id: "pvar_1" }],
        },
      ],
    });
    await first;
  });
});
