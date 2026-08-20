import { describe, expect, it } from "vitest";
import type { ShippingRoutingCandidate } from "@achilles/domain";
import { SupplierRouter } from "./supplier-router";

const candidate = (
  overrides: Partial<ShippingRoutingCandidate> = {},
): ShippingRoutingCandidate => ({
  supplierOfferId: "offer-a",
  provider: "MANUAL",
  quoteId: "quote-a",
  serviceCode: "ECONOMY",
  supplierUnitCostBrl: "8.40",
  shippingCostBrl: "31.00",
  deliveredSupplierCostBrl: "39.40",
  estimatedMinimumDays: 12,
  estimatedMaximumDays: 18,
  isPrimary: true,
  available: true,
  privateLabelSupported: true,
  fulfillmentMode: "PRIVATE_LABEL_DROPSHIP",
  dutiesMode: "UNKNOWN",
  warnings: [],
  ...overrides,
});

describe("SupplierRouter", () => {
  it("escolhe menor custo entregue, não menor preço do produto", () => {
    const result = new SupplierRouter().route(
      [
        candidate(),
        candidate({
          supplierOfferId: "offer-b",
          quoteId: "quote-b",
          supplierUnitCostBrl: "10.20",
          shippingCostBrl: "14.00",
          deliveredSupplierCostBrl: "24.20",
          isPrimary: false,
        }),
      ],
      { privateLabelRequired: false },
    );
    expect(result.recommended?.supplierOfferId).toBe("offer-b");
  });

  it("faz fallback quando fornecedor principal está indisponível", () => {
    const result = new SupplierRouter().route(
      [
        candidate({ available: false }),
        candidate({
          supplierOfferId: "offer-b",
          quoteId: "quote-b",
          isPrimary: false,
        }),
      ],
      { privateLabelRequired: false },
    );
    expect(result.recommended?.supplierOfferId).toBe("offer-b");
  });

  it("prefere compatibilidade private label quando exigida", () => {
    const result = new SupplierRouter().route(
      [
        candidate({ deliveredSupplierCostBrl: "40.00" }),
        candidate({
          supplierOfferId: "generic",
          quoteId: "generic-quote",
          deliveredSupplierCostBrl: "20.00",
          privateLabelSupported: false,
          isPrimary: false,
          fulfillmentMode: "GENERIC_DROPSHIP",
        }),
      ],
      { privateLabelRequired: true },
    );
    expect(result.recommended?.supplierOfferId).toBe("offer-a");
    expect(result.reason).toContain("private label");
  });

  it("mantém alternativas sem alterar fornecedor primário cadastral", () => {
    const result = new SupplierRouter().route(
      [
        candidate(),
        candidate({ quoteId: "quote-b", supplierOfferId: "offer-b" }),
      ],
      { privateLabelRequired: false },
    );
    expect(result.alternatives).toHaveLength(1);
  });

  it("prefere estoque Brasil somente quando competitivo e confiável", () => {
    const result = new SupplierRouter().route(
      [
        candidate({
          quoteId: "import",
          deliveredSupplierCostBrl: "30.00",
          isPrimary: false,
        }),
        candidate({
          quoteId: "brasil",
          supplierOfferId: "offer-brasil",
          deliveredSupplierCostBrl: "32.00",
          estimatedMinimumDays: 2,
          estimatedMaximumDays: 5,
          fulfillmentMode: "BRAZIL_STOCK",
          marginPercent: 18,
          reliabilityScore: 0.9,
          isPrimary: false,
        }),
      ],
      { privateLabelRequired: false, preferBrazilStockWhenCompetitive: true },
    );
    expect(result.recommended?.supplierOfferId).toBe("offer-brasil");
  });

  it("não força estoque Brasil economicamente ruim", () => {
    const result = new SupplierRouter().route(
      [
        candidate({
          quoteId: "import",
          deliveredSupplierCostBrl: "30.00",
          isPrimary: false,
        }),
        candidate({
          quoteId: "brasil",
          supplierOfferId: "offer-brasil",
          deliveredSupplierCostBrl: "55.00",
          estimatedMinimumDays: 2,
          estimatedMaximumDays: 4,
          fulfillmentMode: "BRAZIL_STOCK",
          isPrimary: false,
        }),
      ],
      { privateLabelRequired: false, preferBrazilStockWhenCompetitive: true },
    );
    expect(result.recommended?.quoteId).toBe("import");
  });
});
