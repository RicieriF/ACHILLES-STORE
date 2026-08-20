import type {
  PublicCartDTO,
  PublicCheckoutShippingSelectionDTO,
} from "@achilles/domain";
import { describe, expect, it } from "vitest";
import {
  calculateCheckoutTotals,
  toPublicCheckoutShippingSelection,
} from "./service";

describe("snapshots públicos do checkout", () => {
  it("calcula total exclusivamente no backend sem inventar imposto zero", () => {
    const totals = calculateCheckoutTotals(cart(), [
      selection("group-1", 27.9),
      selection("group-2", 12.1),
    ]);
    expect(totals.products.amount).toBe(298);
    expect(totals.shipping.amount).toBe(40);
    expect(totals.discounts.amount).toBe(0);
    expect(totals.taxes).toEqual({
      known: false,
      amount: null,
      label: "Não determinado",
    });
    expect(totals.total.amount).toBe(338);
    expect(totals.currencyCode).toBe("brl");
  });

  it("sanitiza seleção e nunca expõe fornecedor, custo, subsídio ou routing", () => {
    const publicSelection = toPublicCheckoutShippingSelection({
      shipping_group_id: "group-1",
      shipping_quote_id: "shipq_1",
      method_name: "Entrega Econômica",
      customer_price_brl: "27.90",
      estimated_min_days: 10,
      estimated_max_days: 18,
      duties_mode: "UNKNOWN",
      expires_at: "2030-01-01T00:00:00.000Z",
      cart_fingerprint: "private-cart-hash",
      address_fingerprint: "private-address-hash",
    });
    const serialized = JSON.stringify(publicSelection);
    expect(publicSelection.price.formatted).toContain("27,90");
    expect(serialized).not.toMatch(
      /supplier|provider|cost|subsid|routing|fingerprint|Alibaba|CJ/i,
    );
  });

  it("preserva avisos conservadores DDP, DAP e UNKNOWN", () => {
    const make = (duties_mode: "DDP" | "DAP" | "UNKNOWN") =>
      toPublicCheckoutShippingSelection({
        shipping_group_id: "group-1",
        shipping_quote_id: "shipq_1",
        method_name: "Entrega",
        customer_price_brl: "10",
        estimated_min_days: 1,
        estimated_max_days: 2,
        duties_mode,
        expires_at: "2030-01-01T00:00:00.000Z",
        cart_fingerprint: "x",
        address_fingerprint: "y",
      }).dutiesNotice;
    expect(make("DDP")).toContain("incluídos");
    expect(make("DAP")).toContain("podem ser cobrados");
    expect(make("UNKNOWN")).toContain("não foram determinados");
  });
});

function selection(
  groupId: string,
  amount: number,
): PublicCheckoutShippingSelectionDTO {
  return {
    groupId,
    quoteId: `quote-${groupId}`,
    methodName: "Entrega",
    price: {
      amount,
      currencyCode: "brl",
      formatted: `R$ ${amount.toFixed(2)}`,
    },
    estimatedMinimumDays: 10,
    estimatedMaximumDays: 18,
    dutiesMode: "UNKNOWN",
    dutiesNotice: "Não determinado",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
}

function cart(): PublicCartDTO {
  const money = {
    amount: 298,
    currencyCode: "brl" as const,
    formatted: "R$ 298,00",
  };
  return {
    id: "cart_1",
    itemCount: 2,
    subtotal: money,
    items: [
      {
        id: "item_1",
        productSlug: "lanterna",
        productTitle: "Lanterna",
        variantTitle: "Padrão",
        variantId: "variant_1",
        thumbnail: null,
        quantity: 2,
        unitPrice: { amount: 149, currencyCode: "brl", formatted: "R$ 149,00" },
        total: money,
      },
    ],
  };
}
