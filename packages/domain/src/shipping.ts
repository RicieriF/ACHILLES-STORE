import type { FulfillmentMode } from "./fulfillment.js";

export const shippingProviderCapabilities = [
  "PRODUCT_LOOKUP",
  "LIVE_SHIPPING_QUOTE",
  "ORDER_CREATE",
  "ORDER_PAYMENT",
  "TRACKING",
  "PRIVATE_LABEL",
  "CUSTOM_PACKAGING",
  "SAMPLE_ORDER",
  "SANDBOX_ORDER",
  "MULTI_PACKAGE",
  "DDP",
  "DAP",
  "EXPRESS",
  "ECONOMY",
] as const;

export type ShippingProviderCapability =
  (typeof shippingProviderCapabilities)[number];
export type ShippingProviderHealth =
  "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "DISABLED";
export type DutiesMode = "DDP" | "DAP" | "UNKNOWN";
export type ShippingQuoteStatus =
  "VALID" | "EXPIRED" | "UNAVAILABLE" | "FAILED";

export type ShippingDestination = {
  countryCode: string;
  state?: string | undefined;
  city?: string | undefined;
  postalCode: string;
};

export type PackageMeasurement = {
  weightGrams?: number | undefined;
  lengthCm?: number | undefined;
  widthCm?: number | undefined;
  heightCm?: number | undefined;
};

export type ShippingQuoteRequest = {
  productId: string;
  variantId: string;
  providerProductId: string;
  supplierOfferId: string;
  supplierSku: string;
  quantity: number;
  originCountryCode: string;
  destination: ShippingDestination;
  measurement?: PackageMeasurement | undefined;
};

export type ProviderShippingQuote = {
  provider: string;
  serviceCode: string;
  methodName: string;
  currency: string;
  amount: string;
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
  trackingSupported: boolean;
  dutiesMode: DutiesMode;
  warnings: readonly string[];
  assumptions: readonly string[];
  providerReference: string | null;
  expiresAt: string;
};

export type ShippingProviderCapabilities = {
  provider: string;
  health: ShippingProviderHealth;
  capabilities: readonly ShippingProviderCapability[];
  reason?: string | undefined;
};

export interface ShippingQuoteProvider {
  readonly provider: string;
  quote(input: ShippingQuoteRequest): Promise<readonly ProviderShippingQuote[]>;
  supportsDestination(destination: ShippingDestination): boolean;
  supportsProduct(input: ShippingQuoteRequest): boolean;
  getCapabilities(): ShippingProviderCapabilities;
}

export type ShippingRoutingCandidate = {
  supplierOfferId: string;
  provider: string;
  quoteId: string;
  serviceCode: string;
  supplierUnitCostBrl: string;
  shippingCostBrl: string;
  deliveredSupplierCostBrl: string;
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
  isPrimary: boolean;
  available: boolean;
  privateLabelSupported: boolean;
  fulfillmentMode: FulfillmentMode;
  dutiesMode: DutiesMode;
  warnings: readonly string[];
};

export type SupplierRoutingResult = {
  recommended: ShippingRoutingCandidate | null;
  alternatives: readonly ShippingRoutingCandidate[];
  reason: string;
  scores: Readonly<Record<string, number>>;
};

export type ShippingGroup = {
  id: string;
  supplierOfferId: string;
  provider: string;
  itemVariantIds: readonly string[];
  destination: ShippingDestination;
  quoteIds: readonly string[];
  selectedQuoteId: string | null;
};

export type PublicShippingMethodDTO = {
  id: string;
  name: string;
  price: { amount: number; currencyCode: "brl"; formatted: string };
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
  trackingSupported: boolean;
  dutiesNotice: string;
};

export type PublicShippingQuoteDTO = {
  destinationPostalCode: string;
  shipmentType: "SINGLE" | "MULTI_SHIPMENT";
  methods: PublicShippingMethodDTO[];
  message: string | null;
  expiresAt: string | null;
};

export interface TrackingProvider {
  getTracking(reference: string): Promise<unknown>;
}

export interface DropshippingOrderProvider {
  createDraftOrder(input: unknown): Promise<unknown>;
  validateOrder(input: unknown): Promise<unknown>;
  createOrder(input: unknown): Promise<unknown>;
  getOrder(reference: string): Promise<unknown>;
  cancelOrder?(reference: string): Promise<unknown>;
}
