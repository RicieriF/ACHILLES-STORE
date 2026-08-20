import type { FulfillmentMode } from "./fulfillment.js";
import type { PaymentIntentStatus } from "./payment.js";
import type { PublicMoneyDTO } from "./public-catalog.js";

export const customerOrderStatuses = [
  "PAYMENT_PENDING",
  "PAID",
  "FULFILLMENT_REVIEW",
  "SUPPLIER_APPROVAL_REQUIRED",
  "SUPPLIER_APPROVED",
  "ORDERING_SUPPLIER",
  "SUPPLIER_CONFIRMED",
  "IN_FULFILLMENT",
  "SHIPPED",
  "DELIVERED",
  "EXCEPTION",
  "CANCELLED",
] as const;
export type CustomerOrderStatus = (typeof customerOrderStatuses)[number];

export const supplierGateStatuses = [
  "NOT_READY",
  "REVIEW_REQUIRED",
  "APPROVAL_REQUIRED",
  "APPROVED",
  "BLOCKED",
  "STALE",
  "EXCEPTION",
] as const;
export type SupplierGateStatus = (typeof supplierGateStatuses)[number];

export const supplierOrderStatuses = [
  "DRAFT",
  "APPROVAL_REQUIRED",
  "APPROVED",
  "SUBMITTING",
  "SUBMITTED",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
  "SHIPPED",
  "DELIVERED",
  "EXCEPTION",
] as const;
export type SupplierOrderStatus = (typeof supplierOrderStatuses)[number];

export const trackingStatuses = [
  "LABEL_CREATED",
  "IN_TRANSIT",
  "CUSTOMS",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "UNKNOWN",
] as const;
export type FulfillmentTrackingStatus = (typeof trackingStatuses)[number];

export const orderExceptionTypes = [
  "OUT_OF_STOCK",
  "PRICE_CHANGED",
  "SHIPPING_CHANGED",
  "PROVIDER_UNAVAILABLE",
  "ADDRESS_PROBLEM",
  "COMPLIANCE_HOLD",
  "MARGIN_TOO_LOW",
  "TRACKING_DELAY",
  "SUPPLIER_REJECTED",
  "UNKNOWN",
] as const;
export type OrderExceptionType = (typeof orderExceptionTypes)[number];
export type OrderExceptionSeverity =
  "INFO" | "WARNING" | "ACTION_REQUIRED" | "BLOCKING";
export type OrderExceptionStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type SupplierOrderProviderHealth =
  "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "DISABLED";

export type SupplierRecipientDTO = {
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: "BR";
  phone: string;
  importerIdentity?: string | undefined;
};

export type SupplierOrderProviderCapabilities = {
  quote: boolean;
  stock: boolean;
  createOrder: boolean;
  payOrder: boolean;
  cancelOrder: boolean;
  tracking: boolean;
};

export type SupplierOrderRequest = {
  idempotencyKey: string;
  supplierOrderId: string;
  recipient: SupplierRecipientDTO;
  currency: string;
  expectedTotal: string;
  items: readonly {
    supplierSku: string;
    quantity: number;
  }[];
  scenario?:
    | "accepted"
    | "rejected"
    | "pending"
    | "out_of_stock"
    | "price_changed"
    | "shipping_changed"
    | "tracking_available"
    | "failure"
    | undefined;
};

export type SupplierOrderResult = {
  providerOrderId: string;
  status: "SUBMITTED" | "CONFIRMED" | "REJECTED" | "FAILED";
  sandbox: boolean;
  reason: string | null;
};

export interface SupplierOrderProvider {
  readonly provider: "ALIBABA" | "CJ" | "TEST";
  getHealth(): SupplierOrderProviderHealth;
  getCapabilities(): SupplierOrderProviderCapabilities;
  createOrder(input: SupplierOrderRequest): Promise<SupplierOrderResult>;
  payOrder(providerOrderId: string): Promise<never>;
  cancelOrder(providerOrderId: string): Promise<SupplierOrderResult>;
  getTracking(providerOrderId: string): Promise<{
    carrier: string;
    trackingNumber: string;
    status: FulfillmentTrackingStatus;
  } | null>;
}

export type PublicCustomerOrderDTO = {
  reference: string;
  status: CustomerOrderStatus;
  createdAt: string;
  payment: { status: PaymentIntentStatus; paidAt: string | null };
  total: PublicMoneyDTO;
  items: readonly {
    title: string;
    variantTitle: string;
    quantity: number;
    unitPrice: PublicMoneyDTO;
  }[];
  shipping: readonly {
    package: string;
    method: string;
    eta: string;
  }[];
  tracking: readonly {
    package: string;
    status: FulfillmentTrackingStatus;
    carrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
    lastUpdatedAt: string;
  }[];
};

export type RoutingSnapshot = {
  offerId: string;
  supplierId: string;
  provider: string;
  inventoryStatus: string;
  sourceCost: string;
  shippingCost: string;
  deliveredCost: string;
  currency: string;
  eta: { minimumDays: number; maximumDays: number };
  compatibility: {
    fulfillmentMode: FulfillmentMode;
    privateLabel: boolean;
    compliance: string;
  };
  score: number | null;
  reasons: readonly string[];
  capturedAt: string;
};
