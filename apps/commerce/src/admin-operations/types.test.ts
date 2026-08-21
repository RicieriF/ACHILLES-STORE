import { describe, expect, it } from "vitest";
import {
  deriveAttention,
  deriveOperationalStatus,
  enrichOperationalProduct,
  type OperationalProductCandidate,
} from "./types";

const complete = (): OperationalProductCandidate => ({
  id: "prod_1",
  title: "Lanterna",
  handle: "lanterna",
  status: "published",
  thumbnail: "https://example.invalid/lanterna.jpg",
  sku: "LANT-1",
  category: "Lanternas",
  categoryId: "pcat_1",
  retailPrice: 149,
  compareAtPrice: null,
  landedCost: 70,
  marginPercent: 53,
  stock: null,
  manageInventory: false,
  supplier: "Fornecedor",
  supplierId: "sup_1",
  provider: "ALIBABA",
  origin: "https://example.invalid/source",
  offerId: "supoff_1",
  offerCount: 1,
  availability: "IN_STOCK",
  supplierAvailabilityQuantity: null,
  supplierLeadTimeDays: null,
  fulfillmentMode: "PRIVATE_LABEL_DROPSHIP",
  compliance: "CLEAR",
  commercialReadiness: "READY_FOR_REVIEW",
  pricingStatus: "PRICED",
  shippingStale: false,
  syncStatus: "SYNCED",
  lastSyncAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  featured: false,
});

describe("admin operational product", () => {
  it("marks a complete published product as ready", () => {
    const result = enrichOperationalProduct(complete());
    expect(result.attention).toEqual([]);
    expect(result.operationalStatus).toBe("READY");
    expect(result.publicationEligible).toBe(true);
  });

  it("derives incomplete reasons without inventing values", () => {
    const result = deriveAttention({
      ...complete(),
      thumbnail: null,
      retailPrice: null,
      offerId: null,
      offerCount: 0,
      compliance: "PENDING",
    });
    expect(result).toEqual([
      "SEM_IMAGEM",
      "SEM_PRECO",
      "SEM_FORNECEDOR",
      "COMPLIANCE_REVIEW",
    ]);
  });

  it("prioritizes compliance, provider and stock failures", () => {
    expect(deriveOperationalStatus(["SEM_ESTOQUE", "BLOCKED"])).toBe(
      "COMPLIANCE_HOLD",
    );
    expect(deriveOperationalStatus(["SUPPLIER_UNAVAILABLE"])).toBe(
      "SUPPLIER_UNAVAILABLE",
    );
    expect(deriveOperationalStatus(["SEM_ESTOQUE"])).toBe("OUT_OF_STOCK");
  });
});
