import type { CheckoutStatus } from "@achilles/domain";

const transitions: Readonly<Record<CheckoutStatus, readonly CheckoutStatus[]>> =
  {
    CART: ["CUSTOMER", "BLOCKED", "ERROR"],
    CUSTOMER: ["ADDRESS", "BLOCKED", "ERROR"],
    ADDRESS: ["SHIPPING", "REQUOTE_REQUIRED", "BLOCKED", "ERROR"],
    SHIPPING: [
      "REVIEW",
      "REQUOTE_REQUIRED",
      "EXPIRED_SHIPPING",
      "BLOCKED",
      "ERROR",
    ],
    REVIEW: [
      "READY_FOR_PAYMENT",
      "REQUOTE_REQUIRED",
      "EXPIRED_SHIPPING",
      "BLOCKED",
      "ERROR",
    ],
    READY_FOR_PAYMENT: [
      "PAYMENT_PENDING",
      "PAID",
      "PAYMENT_FAILED",
      "REQUOTE_REQUIRED",
      "EXPIRED_SHIPPING",
      "BLOCKED",
      "ERROR",
    ],
    PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "READY_FOR_PAYMENT", "ERROR"],
    PAID: ["ERROR"],
    PAYMENT_FAILED: ["READY_FOR_PAYMENT", "PAYMENT_PENDING", "PAID", "ERROR"],
    EXPIRED_SHIPPING: ["ADDRESS", "SHIPPING", "BLOCKED", "ERROR"],
    REQUOTE_REQUIRED: ["ADDRESS", "SHIPPING", "BLOCKED", "ERROR"],
    BLOCKED: ["CART", "CUSTOMER", "ADDRESS", "SHIPPING", "ERROR"],
    ERROR: ["CART", "CUSTOMER", "ADDRESS", "SHIPPING", "BLOCKED"],
  };

export function canTransition(
  from: CheckoutStatus,
  to: CheckoutStatus,
): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertCheckoutTransition(
  from: CheckoutStatus,
  to: CheckoutStatus,
): void {
  if (!canTransition(from, to))
    throw new Error(`Transição de checkout inválida: ${from} -> ${to}`);
}
