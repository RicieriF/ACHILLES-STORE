import { describe, expect, it } from "vitest";
import {
  brandingProfileInput,
  paginationInput,
  productPolicyInput,
  supplierInput,
  supplierOfferInput,
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
