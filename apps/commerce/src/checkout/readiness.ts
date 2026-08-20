import type { CheckoutReadinessDTO } from "@achilles/domain";

export type ReadinessInput = {
  cartValid: boolean;
  productsPublic: boolean;
  pricingValid: boolean;
  addressValid: boolean;
  groupCount: number;
  selectionCount: number;
  selectionsCurrent: boolean;
  totalsCalculated: boolean;
  blocked: boolean;
  allowUnknownTaxes: boolean;
  taxesKnown: boolean;
};

export class CheckoutReadinessPolicy {
  assess(input: ReadinessInput): CheckoutReadinessDTO {
    const reasons: string[] = [];
    if (!input.cartValid) reasons.push("CART_INVALID");
    if (!input.productsPublic) reasons.push("PRODUCT_NOT_PUBLIC");
    if (!input.pricingValid) reasons.push("PRICE_CHANGED");
    if (!input.addressValid) reasons.push("ADDRESS_INVALID");
    if (input.groupCount === 0) reasons.push("SHIPPING_NOT_QUOTED");
    if (input.groupCount !== input.selectionCount)
      reasons.push("SHIPPING_SELECTION_INCOMPLETE");
    if (!input.selectionsCurrent) reasons.push("SHIPPING_EXPIRED_OR_STALE");
    if (!input.totalsCalculated) reasons.push("TOTALS_NOT_CALCULATED");
    if (input.blocked) reasons.push("CHECKOUT_BLOCKED");
    if (!input.taxesKnown && !input.allowUnknownTaxes)
      reasons.push("TAXES_UNKNOWN_NOT_ALLOWED");
    return { ready: reasons.length === 0, reasons };
  }
}
