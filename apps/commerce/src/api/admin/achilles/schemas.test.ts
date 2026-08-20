import { describe, expect, it } from "vitest";
import {
  brandingProfileInput,
  paginationInput,
  productPolicyInput,
  pricingAssumptionsInput,
  supplierInput,
  supplierOfferInput,
  supplierOfferPatchInput,
} from "./schemas";

const offer = {
  supplier_id: "sup_1",
  product_id: "prod_1",
  supplier_product_id: "SKU-1",
  source_url: "https://example.invalid/product/1",
  currency: "usd",
  unit_cost: "12.3456",
  moq: 1,
  availability: "IN_STOCK" as const,
  fulfillment_mode: "PRIVATE_LABEL_DROPSHIP" as const,
  private_label_supported: true,
  branding_moq: 20,
  is_primary: true,
};

describe("admin supplier validation", () => {
  it("accepts controlled supplier fields and normalizes country/provider data", () => {
    expect(
      supplierInput.parse({
        name: "Fornecedor Dev",
        provider: "MANUAL",
        country_code: "br",
      }).country_code,
    ).toBe("BR");
  });

  it("rejects unknown providers and unsafe source protocols", () => {
    expect(() =>
      supplierInput.parse({
        name: "Fornecedor",
        provider: "UNKNOWN",
        country_code: "CN",
      }),
    ).toThrow();
    expect(() =>
      supplierOfferInput.parse({ ...offer, source_url: "file:///secret" }),
    ).toThrow();
  });

  it("supports all fulfillment modes with technical values", () => {
    for (const fulfillment_mode of [
      "PRIVATE_LABEL_DROPSHIP",
      "GENERIC_DROPSHIP",
      "BRAZIL_STOCK",
    ] as const) {
      expect(
        supplierOfferInput.parse({ ...offer, fulfillment_mode })
          .fulfillment_mode,
      ).toBe(fulfillment_mode);
    }
  });

  it("accepts a manual Brazil Stock supplier and operational offer metadata", () => {
    expect(
      supplierInput.parse({
        name: "Distribuidor Nacional",
        provider: "BRAZIL_STOCK",
        country_code: "BR",
      }).provider,
    ).toBe("BRAZIL_STOCK");
    expect(
      supplierOfferInput.parse({
        ...offer,
        currency: "BRL",
        fulfillment_mode: "BRAZIL_STOCK",
        private_label_supported: false,
        branding_moq: null,
        freight_metadata: {
          delivery_days: 3,
          shipping_mode: "DOMESTIC_MANUAL",
          tracking_supported: true,
        },
      }).freight_metadata,
    ).toMatchObject({ delivery_days: 3, tracking_supported: true });
  });

  it("does not apply create defaults to omitted PATCH fields", () => {
    expect(supplierOfferPatchInput.parse({ availability: "IN_STOCK" })).toEqual(
      { availability: "IN_STOCK" },
    );
    expect(supplierOfferPatchInput.parse({ unit_cost: "8.50" })).toEqual({
      unit_cost: "8.50",
    });
  });

  it("requires private-label capability for branding configuration", () => {
    expect(() =>
      supplierOfferInput.parse({ ...offer, private_label_supported: false }),
    ).toThrow();
  });

  it("validates BrandingProfile costs, references, MOQ and lead time", () => {
    expect(
      brandingProfileInput.parse({
        supplier_id: "sup_1",
        name: "Achilles",
        brand_name: "Achilles",
        logo_asset_reference: "https://example.invalid/logo.svg",
        branding_moq: 10,
        setup_cost: "20.00",
        per_unit_branding_cost: "1.50",
        currency: "usd",
        lead_time_days: 7,
      }).currency,
    ).toBe("USD");
  });

  it("supports pagination with bounded limits", () => {
    expect(paginationInput.parse({ limit: "25", offset: "5" })).toMatchObject({
      limit: 25,
      offset: 5,
    });
    expect(() => paginationInput.parse({ limit: 101 })).toThrow();
  });
});

describe("admin pricing validation", () => {
  const pricing = {
    fxRate: "5.42",
    fxSource: "Manual Admin",
    fxTimestamp: "2026-08-20T12:00:00.000Z",
    internationalShipping: "28.00",
    internationalShippingAllocationMethod: "PER_UNIT" as const,
    shippingAllocationQuantity: 1,
    customsTaxEstimate: "42.50",
    customsStrategy: "MANUAL_QUOTE" as const,
    brandingUnitCost: "3.00",
    brandingSetupCost: "20.00",
    brandingSetupAllocationQuantity: 10,
    paymentGatewayPercent: "5.00",
    paymentGatewayFixed: "1.00",
    paymentGatewayProvider: "Premissa manual",
    localDeliveryCost: "12.00",
    returnsRiskReservePercent: "2.00",
    returnsRiskReserveFixed: "1.00",
    operationalReservePercent: "3.00",
    operationalReserveFixed: "2.00",
    targetMarginPercent: "30.00",
    promotionalBufferPercent: "5.00",
    assumptions: ["Estimativa manual"],
  };

  it("aceita premissas completas e estratégias tributárias explícitas", () => {
    expect(pricingAssumptionsInput.parse(pricing).customsStrategy).toBe(
      "MANUAL_QUOTE",
    );
  });

  it("rejeita FX ausente, estratégia tributária ausente e valores negativos", () => {
    expect(() =>
      pricingAssumptionsInput.parse({ ...pricing, fxRate: undefined }),
    ).toThrow();
    expect(() =>
      pricingAssumptionsInput.parse({ ...pricing, customsStrategy: undefined }),
    ).toThrow();
    expect(() =>
      pricingAssumptionsInput.parse({ ...pricing, localDeliveryCost: "-1" }),
    ).toThrow();
  });
});

describe("admin compliance validation", () => {
  const base = {
    fulfillment_mode: "PRIVATE_LABEL_DROPSHIP" as const,
    compliance_notes: null,
  };

  it.each(["PENDING", "CLEAR", "REVIEW_REQUIRED", "BLOCKED"] as const)(
    "allows %s for ordinary products",
    (compliance_status) => {
      expect(
        productPolicyInput.parse({
          ...base,
          sensitivity: "ORDINARY",
          compliance_status,
        }).compliance_status,
      ).toBe(compliance_status);
    },
  );

  it("forces blades into review or blocked", () => {
    expect(() =>
      productPolicyInput.parse({
        ...base,
        sensitivity: "EDGED_TOOL",
        compliance_status: "CLEAR",
      }),
    ).toThrow();
    expect(
      productPolicyInput.parse({
        ...base,
        sensitivity: "EDGED_TOOL",
        compliance_status: "REVIEW_REQUIRED",
      }).compliance_status,
    ).toBe("REVIEW_REQUIRED");
  });

  it("keeps controlled items blocked", () => {
    expect(() =>
      productPolicyInput.parse({
        ...base,
        sensitivity: "CONTROLLED_ITEM",
        compliance_status: "REVIEW_REQUIRED",
      }),
    ).toThrow();
    expect(
      productPolicyInput.parse({
        ...base,
        sensitivity: "CONTROLLED_ITEM",
        compliance_status: "BLOCKED",
      }).compliance_status,
    ).toBe("BLOCKED");
  });
});
