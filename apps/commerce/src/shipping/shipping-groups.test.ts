import { describe, expect, it } from "vitest";
import { buildShippingGroups, shipmentTypeForGroups } from "./shipping-groups";

describe("ShippingGroup", () => {
  it("agrupa itens do mesmo provider/oferta", () => {
    const groups = buildShippingGroups(
      [
        {
          variantId: "v1",
          supplierOfferId: "o1",
          provider: "MANUAL",
          quoteId: "q1",
        },
        {
          variantId: "v2",
          supplierOfferId: "o1",
          provider: "MANUAL",
          quoteId: "q2",
        },
      ],
      { countryCode: "BR", postalCode: "01310100" },
    );
    expect(groups).toHaveLength(1);
    expect(shipmentTypeForGroups(groups)).toBe("SINGLE");
  });

  it("indica MULTI_SHIPMENT para fornecedores diferentes", () => {
    const groups = buildShippingGroups(
      [
        {
          variantId: "v1",
          supplierOfferId: "o1",
          provider: "MANUAL",
          quoteId: "q1",
        },
        {
          variantId: "v2",
          supplierOfferId: "o2",
          provider: "CJ",
          quoteId: "q2",
        },
      ],
      { countryCode: "BR", postalCode: "01310100" },
    );
    expect(groups).toHaveLength(2);
    expect(shipmentTypeForGroups(groups)).toBe("MULTI_SHIPMENT");
  });
});
