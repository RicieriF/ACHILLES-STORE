import { describe, expect, it } from "vitest";
import {
  brandingProfileSchema,
  brazilCommerceDefaults,
  defaultComplianceStatus,
  primaryFulfillmentMode,
  supplierSchema,
  validateSupplierOffersForProduct,
} from "./index.js";

describe("Brazil commerce defaults", () => {
  it("uses Brazil, BRL, and pt-BR without defining tax rules", () => {
    expect(brazilCommerceDefaults).toMatchObject({
      countryCode: "br",
      currencyCode: "brl",
      businessLocale: "pt-BR",
      regionName: "Brasil / BRL",
    });
    expect(primaryFulfillmentMode).toBe("PRIVATE_LABEL_DROPSHIP");
  });
});

describe("supplier domain validation", () => {
  const offer = {
    id: "offer_a",
    supplierId: "supplier_a",
    productId: "prod_a",
    supplierProductId: "external-a",
    sourceUrl: "https://supplier.example/products/a",
    currency: "USD",
    unitCost: "12.45",
    moq: 1,
    isPrimary: true,
    privateLabelSupported: true,
  } as const;

  it("validates a supplier without provider-specific behavior", () => {
    expect(
      supplierSchema.parse({ name: "Fornecedor fictício", provider: "MANUAL" }),
    ).toEqual({
      name: "Fornecedor fictício",
      provider: "MANUAL",
      status: "ACTIVE",
    });
  });

  it("allows multiple offers for a product with one primary", () => {
    const offers = validateSupplierOffersForProduct("prod_a", [
      offer,
      { ...offer, id: "offer_b", supplierId: "supplier_b", isPrimary: false },
    ]);
    expect(offers).toHaveLength(2);
    expect(offers.find((candidate) => candidate.isPrimary)?.id).toBe("offer_a");
  });

  it("rejects multiple primary suppliers for one product", () => {
    expect(() =>
      validateSupplierOffersForProduct("prod_a", [
        offer,
        { ...offer, id: "offer_b", supplierId: "supplier_b" },
      ]),
    ).toThrow("at most one primary");
  });

  it("validates branding money as decimal strings", () => {
    expect(
      brandingProfileSchema.parse({
        name: "Perfil fictício",
        brandName: "Achilles",
        setupCost: "100.00",
        perUnitBrandingCost: "1.25",
      }),
    ).toMatchObject({ currency: "USD", language: "pt-BR" });
    expect(() =>
      brandingProfileSchema.parse({
        name: "Perfil fictício",
        brandName: "Achilles",
        setupCost: 100.1,
      }),
    ).toThrow();
  });
});

describe("compliance defaults", () => {
  it("requires review for blades and blocks controlled items", () => {
    expect(defaultComplianceStatus("EDGED_TOOL")).toBe("REVIEW_REQUIRED");
    expect(defaultComplianceStatus("CONTROLLED_ITEM")).toBe("BLOCKED");
    expect(defaultComplianceStatus("ORDINARY")).toBe("PENDING");
  });
});
