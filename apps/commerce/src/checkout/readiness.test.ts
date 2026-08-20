import { describe, expect, it } from "vitest";
import { CheckoutReadinessPolicy, type ReadinessInput } from "./readiness";

const policy = new CheckoutReadinessPolicy();
const valid: ReadinessInput = {
  cartValid: true,
  productsPublic: true,
  pricingValid: true,
  addressValid: true,
  groupCount: 2,
  selectionCount: 2,
  selectionsCurrent: true,
  totalsCalculated: true,
  blocked: false,
  allowUnknownTaxes: true,
  taxesKnown: false,
};

describe("CheckoutReadinessPolicy", () => {
  it("autoriza READY_FOR_PAYMENT sob política explícita de tributos desconhecidos", () => {
    expect(policy.assess(valid)).toEqual({ ready: true, reasons: [] });
  });

  it.each([
    ["cart inválido", { cartValid: false }, "CART_INVALID"],
    ["produto despublicado", { productsPublic: false }, "PRODUCT_NOT_PUBLIC"],
    ["preço alterado", { pricingValid: false }, "PRICE_CHANGED"],
    ["endereço inválido", { addressValid: false }, "ADDRESS_INVALID"],
    [
      "sem cotação",
      { groupCount: 0, selectionCount: 0 },
      "SHIPPING_NOT_QUOTED",
    ],
    [
      "seleção por grupo incompleta",
      { selectionCount: 1 },
      "SHIPPING_SELECTION_INCOMPLETE",
    ],
    [
      "frete expirado ou stale",
      { selectionsCurrent: false },
      "SHIPPING_EXPIRED_OR_STALE",
    ],
    ["total ausente", { totalsCalculated: false }, "TOTALS_NOT_CALCULATED"],
    ["item bloqueado", { blocked: true }, "CHECKOUT_BLOCKED"],
    [
      "tributo desconhecido não permitido",
      { allowUnknownTaxes: false },
      "TAXES_UNKNOWN_NOT_ALLOWED",
    ],
  ] as const)("bloqueia %s", (_label, change, reason) => {
    const result = policy.assess({ ...valid, ...change });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(reason);
  });
});
