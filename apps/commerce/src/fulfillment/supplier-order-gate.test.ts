import { describe, expect, it } from "vitest";
import { SupplierMarginProtection } from "./margin-protection";
import {
  SupplierOrderGate,
  type SupplierGateInput,
} from "./supplier-order-gate";

const margin = new SupplierMarginProtection().assess({
  revenue: "149.00",
  productCost: "42.50",
  shippingCost: "25.00",
  paymentFees: "7.45",
  reserves: "7.45",
  minimumMarginPercent: 10,
});
const ready: SupplierGateInput = {
  customerOrderExists: true,
  paymentStatus: "PAID",
  paymentRefundedOrCancelled: false,
  productsValid: true,
  complianceAllowed: true,
  offerActive: true,
  supplierActive: true,
  available: true,
  quantityValid: true,
  costsCurrent: true,
  shippingCurrent: true,
  addressValid: true,
  shippingMethodValid: true,
  providerHealth: "HEALTHY",
  fulfillmentCapable: true,
  duplicateSupplierOrder: false,
  privateLabelReady: true,
  importerIdentityReady: true,
  approvalFingerprintCurrent: true,
  margin,
};

describe("SupplierOrderGate", () => {
  it("exige pagamento PAID e aprovação humana", () => {
    expect(new SupplierOrderGate().evaluate(ready)).toEqual({
      status: "APPROVAL_REQUIRED",
      reasons: ["HUMAN_APPROVAL_REQUIRED"],
    });
    expect(
      new SupplierOrderGate().evaluate({ ...ready, paymentStatus: "PENDING" }),
    ).toMatchObject({ status: "BLOCKED", reasons: ["PAYMENT_NOT_PAID"] });
  });

  it.each([
    ["cost change", { costsCurrent: false }, "PRICE_CHANGED"],
    ["freight change", { shippingCurrent: false }, "SHIPPING_CHANGED"],
    ["private label", { privateLabelReady: false }, "PRIVATE_LABEL_INCOMPLETE"],
  ])("leva %s para revisão", (_label, override, reason) => {
    expect(
      new SupplierOrderGate().evaluate({ ...ready, ...override }),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      reasons: [reason],
    });
  });

  it.each([
    ["out of stock", { available: false }, "OUT_OF_STOCK"],
    [
      "provider disabled",
      { providerHealth: "DISABLED" },
      "PROVIDER_UNAVAILABLE",
    ],
    ["refund", { paymentRefundedOrCancelled: true }, "PAYMENT_REVERSED"],
    ["duplicate", { duplicateSupplierOrder: true }, "SUPPLIER_ORDER_EXISTS"],
  ])("bloqueia %s", (_label, override, reason) => {
    expect(
      new SupplierOrderGate().evaluate({ ...ready, ...override }),
    ).toMatchObject({
      status: "BLOCKED",
      reasons: [reason],
    });
  });

  it("invalida a aprovação quando o snapshot muda", () => {
    expect(
      new SupplierOrderGate().evaluate({
        ...ready,
        approvalFingerprintCurrent: false,
      }),
    ).toMatchObject({ status: "STALE" });
  });
});

describe("SupplierMarginProtection", () => {
  it("não trata custos desconhecidos como zero", () => {
    expect(
      new SupplierMarginProtection().assess({
        revenue: "149",
        productCost: null,
        shippingCost: "10",
        paymentFees: "5",
        reserves: "5",
        minimumMarginPercent: 10,
      }),
    ).toMatchObject({ status: "REVIEW_REQUIRED", margin: null });
  });

  it("bloqueia margem abaixo do limite", () => {
    expect(
      new SupplierMarginProtection().assess({
        revenue: "100",
        productCost: "80",
        shippingCost: "10",
        paymentFees: "5",
        reserves: "5",
        minimumMarginPercent: 10,
      }),
    ).toMatchObject({ status: "BLOCKED", marginPercent: "0.00" });
  });
});
