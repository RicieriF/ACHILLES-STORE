import { describe, expect, it } from "vitest";
import type { SupplierOrderRequest } from "@achilles/domain";
import { SupplierMarginProtection } from "./margin-protection";
import { TestSupplierOrderProvider } from "./providers";
import { SupplierOrderGate } from "./supplier-order-gate";

describe("paid order to sandbox fulfillment", () => {
  it("requires approval before creating one deterministic TEST order with tracking", async () => {
    const margin = new SupplierMarginProtection().assess({
      revenue: "149.00",
      productCost: "42.50",
      shippingCost: "25.00",
      paymentFees: "7.45",
      reserves: "7.45",
      minimumMarginPercent: 10,
    });
    const decision = new SupplierOrderGate().evaluate({
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
    });
    expect(decision).toEqual({
      status: "APPROVAL_REQUIRED",
      reasons: ["HUMAN_APPROVAL_REQUIRED"],
    });

    const request: SupplierOrderRequest = {
      idempotencyKey: "customer_order_1:fulfillment_group_1:v1",
      supplierOrderId: "supplier_order_1",
      recipient: {
        name: "CLIENTE TESTE",
        address1: "Avenida***",
        address2: null,
        city: "São Paulo",
        state: "SP",
        postalCode: "*****100",
        countryCode: "BR",
        phone: "TEST-NOT-SENT",
      },
      currency: "BRL",
      expectedTotal: "67.50",
      items: [{ supplierSku: "TEST-SKU", quantity: 1 }],
      scenario: "tracking_available",
    };
    const provider = new TestSupplierOrderProvider();
    const first = await provider.createOrder(request);
    const repeated = await provider.createOrder(request);

    expect(repeated).toEqual(first);
    expect(first).toMatchObject({ status: "CONFIRMED", sandbox: true });
    const tracking = await provider.getTracking(first.providerOrderId);
    expect(tracking).toMatchObject({
      carrier: "ACHILLES TEST LOGISTICS",
      status: "IN_TRANSIT",
    });
    expect(tracking?.trackingNumber).toMatch(/^TEST-/);
  });

  it("never passes a pending or refunded payment through the gate", () => {
    const margin = new SupplierMarginProtection().assess({
      revenue: "149.00",
      productCost: "42.50",
      shippingCost: "25.00",
      paymentFees: "7.45",
      reserves: "7.45",
      minimumMarginPercent: 10,
    });
    const base = {
      customerOrderExists: true,
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

    expect(
      new SupplierOrderGate().evaluate({ ...base, paymentStatus: "PENDING" }),
    ).toMatchObject({ status: "BLOCKED", reasons: ["PAYMENT_NOT_PAID"] });
    expect(
      new SupplierOrderGate().evaluate({
        ...base,
        paymentStatus: "PAID",
        paymentRefundedOrCancelled: true,
      }),
    ).toMatchObject({ status: "BLOCKED", reasons: ["PAYMENT_REVERSED"] });
  });
});
