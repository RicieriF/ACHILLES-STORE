import type { SupplierGateStatus } from "@achilles/domain";
import type { MarginAssessment } from "./margin-protection";

export type SupplierGateInput = {
  customerOrderExists: boolean;
  paymentStatus: string;
  paymentRefundedOrCancelled: boolean;
  productsValid: boolean;
  complianceAllowed: boolean;
  offerActive: boolean;
  supplierActive: boolean;
  available: boolean;
  quantityValid: boolean;
  costsCurrent: boolean;
  shippingCurrent: boolean;
  addressValid: boolean;
  shippingMethodValid: boolean;
  providerHealth: string;
  fulfillmentCapable: boolean;
  duplicateSupplierOrder: boolean;
  privateLabelReady: boolean;
  importerIdentityReady: boolean;
  approvalFingerprintCurrent: boolean;
  margin: MarginAssessment;
};

export type SupplierGateDecision = {
  status: SupplierGateStatus;
  reasons: readonly string[];
};

export class SupplierOrderGate {
  evaluate(input: SupplierGateInput): SupplierGateDecision {
    const blocking: string[] = [];
    const review: string[] = [];
    if (!input.customerOrderExists) blocking.push("CUSTOMER_ORDER_MISSING");
    if (input.paymentStatus !== "PAID") blocking.push("PAYMENT_NOT_PAID");
    if (input.paymentRefundedOrCancelled) blocking.push("PAYMENT_REVERSED");
    if (!input.productsValid) blocking.push("PRODUCT_INVALID");
    if (!input.complianceAllowed) blocking.push("COMPLIANCE_HOLD");
    if (!input.offerActive || !input.supplierActive)
      blocking.push("SUPPLIER_OFFER_INACTIVE");
    if (!input.available) blocking.push("OUT_OF_STOCK");
    if (!input.quantityValid) blocking.push("QUANTITY_UNAVAILABLE");
    if (!input.addressValid) blocking.push("ADDRESS_PROBLEM");
    if (!input.shippingMethodValid) blocking.push("SHIPPING_METHOD_INVALID");
    if (["UNAVAILABLE", "DISABLED"].includes(input.providerHealth))
      blocking.push("PROVIDER_UNAVAILABLE");
    if (!input.fulfillmentCapable) blocking.push("FULFILLMENT_UNSUPPORTED");
    if (input.duplicateSupplierOrder) blocking.push("SUPPLIER_ORDER_EXISTS");
    if (!input.costsCurrent) review.push("PRICE_CHANGED");
    if (!input.shippingCurrent) review.push("SHIPPING_CHANGED");
    if (!input.privateLabelReady) review.push("PRIVATE_LABEL_INCOMPLETE");
    if (!input.importerIdentityReady) review.push("IMPORTER_IDENTITY_REQUIRED");
    if (input.margin.status !== "PASS") review.push(...input.margin.reasons);
    if (!input.approvalFingerprintCurrent)
      return {
        status: "STALE",
        reasons: ["APPROVAL_SNAPSHOT_CHANGED", ...blocking, ...review],
      };
    if (blocking.length) return { status: "BLOCKED", reasons: blocking };
    if (review.length) return { status: "REVIEW_REQUIRED", reasons: review };
    return {
      status: "APPROVAL_REQUIRED",
      reasons: ["HUMAN_APPROVAL_REQUIRED"],
    };
  }
}
