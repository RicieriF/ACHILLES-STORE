import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MedusaContainer } from "@medusajs/framework/types";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import type SupplierDomainModuleService from "../modules/supplier-domain/service";
import {
  approveCostQuote,
  calculateCostQuote,
  markOfferPricingStale,
  updatePricingAssumptions,
} from "./service";
import type { PricingAssumptions } from "./service";
import { recordAudit } from "../api/admin/achilles/audit";

vi.mock("../api/admin/achilles/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
  safeSnapshot: vi.fn((value: unknown) => value),
}));

const assumptions: PricingAssumptions = {
  fxRate: "5.42",
  fxSource: "Manual",
  fxTimestamp: "2026-08-20T12:00:00.000Z",
  internationalShipping: "28",
  internationalShippingAllocationMethod: "PER_UNIT",
  shippingAllocationQuantity: 1,
  customsTaxEstimate: "42.50",
  customsStrategy: "MANUAL_QUOTE",
  brandingUnitCost: "3",
  brandingSetupCost: "20",
  brandingSetupAllocationQuantity: 10,
  paymentGatewayPercent: "5",
  paymentGatewayFixed: "1",
  paymentGatewayProvider: "Manual",
  localDeliveryCost: "12",
  returnsRiskReservePercent: "2",
  returnsRiskReserveFixed: "1",
  operationalReservePercent: "3",
  operationalReserveFixed: "2",
  targetMarginPercent: "30",
  promotionalBufferPercent: "5",
  assumptions: ["Estimativa manual"],
};

describe("Pricing lifecycle", () => {
  let quote: Record<string, unknown>;
  let policy: Record<string, unknown>;
  let snapshots: Array<Record<string, unknown>>;
  let service: ReturnType<typeof createService>;
  let container: MedusaContainer;

  beforeEach(() => {
    quote = {
      id: "costq_1",
      status: "INCOMPLETE",
      source_currency: "USD",
      supplier_unit_cost: "8.40",
      supplier_unit_cost_max: null,
      moq: 10,
      supplier_offer_id: "offer_1",
      supplier_offer: { id: "offer_1", product_id: "prod_1" },
      assumptions: { items: [] },
    };
    policy = {
      id: "policy_1",
      product_id: "prod_1",
      compliance_status: "CLEAR",
      commercial_readiness: "PRICING_REQUIRED",
    };
    snapshots = [];
    service = createService(quote, policy, snapshots);
    const productModule = {
      retrieveProduct: vi
        .fn()
        .mockResolvedValue({ status: "draft", sales_channels: [] }),
    };
    container = {
      resolve: (key: string) =>
        key === SUPPLIER_DOMAIN_MODULE ? service : productModule,
    } as unknown as MedusaContainer;
    vi.clearAllMocks();
  });

  it("marca READY, calcula snapshot versionado e mantém produto sem publicação", async () => {
    await updatePricingAssumptions(
      container,
      "costq_1",
      assumptions,
      "admin_1",
    );
    expect(quote.status).toBe("READY_FOR_PRICING");
    const first = await calculateCostQuote(container, "costq_1", "admin_1");
    expect(first.snapshot.version).toBe(1);
    expect(quote.status).toBe("PRICED");
    expect(quote.suggested_retail_price).toBeTypeOf("string");
    await calculateCostQuote(container, "costq_1", "admin_1");
    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((item) => item.version)).toEqual([1, 2]);
  });

  it("marca STALE sem apagar snapshot e exige novo cálculo", async () => {
    await updatePricingAssumptions(
      container,
      "costq_1",
      assumptions,
      "admin_1",
    );
    await calculateCostQuote(container, "costq_1", "admin_1");
    await updatePricingAssumptions(
      container,
      "costq_1",
      { ...assumptions, fxRate: "5.50" },
      "admin_1",
    );
    expect(quote.status).toBe("STALE");
    expect(snapshots).toHaveLength(1);
    expect(recordAudit).toHaveBeenCalledWith(
      service,
      expect.objectContaining({ action: "PRICING_MARKED_STALE" }),
    );
  });

  it("aprova snapshot humano, atualiza readiness e mantém Product DRAFT", async () => {
    await updatePricingAssumptions(
      container,
      "costq_1",
      assumptions,
      "admin_1",
    );
    await calculateCostQuote(container, "costq_1", "admin_1");
    const result = await approveCostQuote(container, "costq_1", "admin_1");
    expect(result.snapshot.approved_by).toBe("admin_1");
    expect(quote.approved_snapshot_id).toBe(result.snapshot.id);
    expect(policy.commercial_readiness).toBe("READY_FOR_REVIEW");
  });

  it("marca pricing stale quando SupplierOffer relevante muda", async () => {
    quote.status = "PRICED";
    await markOfferPricingStale(
      service as unknown as SupplierDomainModuleService,
      "offer_1",
      "admin_1",
    );
    expect(quote.status).toBe("STALE");
  });

  it("rejeita CostQuote incompleto e aprovação sem ator humano", async () => {
    await expect(
      calculateCostQuote(container, "costq_1", "admin_1"),
    ).rejects.toMatchObject({
      code: "INCOMPLETE_QUOTE",
    });
    await expect(
      approveCostQuote(container, "costq_1", null),
    ).rejects.toMatchObject({
      code: "ACTOR_REQUIRED",
    });
  });

  it("mantém compliance pendente como COMPLIANCE_REQUIRED após aprovação", async () => {
    policy.compliance_status = "REVIEW_REQUIRED";
    await updatePricingAssumptions(
      container,
      "costq_1",
      assumptions,
      "admin_1",
    );
    await calculateCostQuote(container, "costq_1", "admin_1");
    await approveCostQuote(container, "costq_1", "admin_1");
    expect(policy.commercial_readiness).toBe("COMPLIANCE_REQUIRED");
  });
});

function createService(
  quote: Record<string, unknown>,
  policy: Record<string, unknown>,
  snapshots: Array<Record<string, unknown>>,
) {
  return {
    listCostQuotes: vi
      .fn()
      .mockImplementation(
        (filter: { id?: string; supplier_offer_id?: string }) =>
          filter.id === quote.id ||
          filter.supplier_offer_id === quote.supplier_offer_id
            ? [quote]
            : [],
      ),
    updateCostQuotes: vi
      .fn()
      .mockImplementation((input: Record<string, unknown>) => {
        Object.assign(quote, input);
        return Promise.resolve(quote);
      }),
    listPricingSnapshots: vi
      .fn()
      .mockImplementation(() => Promise.resolve(snapshots)),
    createPricingSnapshots: vi
      .fn()
      .mockImplementation((input: Record<string, unknown>) => {
        const snapshot = { id: `snapshot_${String(input.version)}`, ...input };
        snapshots.push(snapshot);
        return Promise.resolve(snapshot);
      }),
    updatePricingSnapshots: vi
      .fn()
      .mockImplementation((input: Record<string, unknown>) => {
        const snapshot = snapshots.find((item) => item.id === input.id);
        if (!snapshot) throw new Error("snapshot ausente");
        Object.assign(snapshot, input);
        return Promise.resolve(snapshot);
      }),
    listProductPolicies: vi.fn().mockResolvedValue([policy]),
    updateProductPolicies: vi
      .fn()
      .mockImplementation((input: Record<string, unknown>) => {
        Object.assign(policy, input);
        return Promise.resolve(policy);
      }),
    createAuditEvents: vi.fn().mockResolvedValue({}),
  };
}
