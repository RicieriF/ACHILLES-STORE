import { describe, expect, it } from "vitest";
import { publicShippingInput } from "../api/achilles/store/shipping/http";
import { shippingQuoteStatus } from "./engine";

describe("shipping engine safety", () => {
  it("marca cotação válida, expirada e sem FX", () => {
    const future = "2026-08-21T00:00:00.000Z";
    const past = "2026-08-19T00:00:00.000Z";
    const now = new Date("2026-08-20T00:00:00.000Z").getTime();
    expect(shippingQuoteStatus(future, true, now)).toBe("VALID");
    expect(shippingQuoteStatus(past, true, now)).toBe("EXPIRED");
    expect(shippingQuoteStatus(future, false, now)).toBe("UNAVAILABLE");
  });

  it("não aceita Supplier IDs nem campos internos no endpoint público", () => {
    expect(() =>
      publicShippingInput.parse({
        variantId: "variant_1",
        quantity: 1,
        postalCode: "01310-100",
        supplierOfferId: "secret-offer",
      }),
    ).toThrow();
  });

  it("DTO público não define provider, SupplierOffer ou custo interno", () => {
    const dto = {
      destinationPostalCode: "01310100",
      shipmentType: "SINGLE",
      methods: [
        {
          id: "shipq_public",
          name: "Entrega Econômica",
          price: { amount: 79.9, currencyCode: "brl", formatted: "R$ 79,90" },
          estimatedMinimumDays: 12,
          estimatedMaximumDays: 18,
          trackingSupported: true,
          dutiesNotice: "Tratamento tributário será confirmado.",
        },
      ],
      message: null,
      expiresAt: "2026-08-20T12:05:00.000Z",
    };
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toMatch(
      /Alibaba|CJ|Supplier|supplierOffer|unitCost|provider/,
    );
  });
});
