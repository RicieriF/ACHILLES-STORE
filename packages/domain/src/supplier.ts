export interface SupplierProductRef {
  provider: string;
  supplierProductId: string;
  sourceUrl: string;
}
export type ImportCompliance = "CLEAR" | "REVIEW_REQUIRED" | "BLOCKED";
export interface SupplierProductSource {
  reference: SupplierProductRef;
  title?: string | undefined;
  description?: string | undefined;
  currency?: string | undefined;
  priceMin?: string | undefined;
  priceMax?: string | undefined;
  moq?: number | undefined;
  category?: string | undefined;
  media: readonly string[];
  specifications: Readonly<Record<string, string>>;
  variants: readonly SupplierVariant[];
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  obtainedAt: string;
  method: "OFFICIAL_API" | "PUBLIC_PAGE" | "MANUAL";
}
export interface NormalizedSupplierProduct {
  source: SupplierProductSource;
  title?: string | undefined;
  description?: string | undefined;
  currency?: string | undefined;
  priceMin?: string | undefined;
  priceMax?: string | undefined;
  moq?: number | undefined;
  categorySuggested?: string | undefined;
  specifications: Readonly<Record<string, string>>;
  variants: readonly SupplierVariant[];
  compliance: ImportCompliance;
  alerts: readonly string[];
  normalizerVersion: string;
}
export interface SupplierVariant {
  supplierSku: string;
  title: string;
  attributes: Readonly<Record<string, string>>;
}
export interface Money {
  amount: string;
  currency: string;
}
export interface Availability {
  available: boolean;
  quantity?: number;
  checkedAt: string;
}
export interface ShippingQuote {
  cost: Money;
  estimatedDays?: { minimum: number; maximum: number };
  assumptions: readonly string[];
}
export interface SupplierOrderDraft {
  idempotencyKey: string;
  supplierProductId: string;
  supplierSku: string;
  quantity: number;
  shipToCountry: string;
}
export interface SupplierOrder {
  supplierOrderId: string;
  status: "DRAFT" | "APPROVAL_REQUIRED" | "PLACED" | "FAILED" | "CANCELLED";
}
export interface Tracking {
  carrier?: string;
  trackingNumber?: string;
  events: readonly { occurredAt: string; description: string }[];
}
export interface BrandingOptions {
  supported: boolean;
  minimumOrderQuantity?: number;
  leadTimeDays?: number;
  setupCost?: Money;
  perUnitCost?: Money;
  notes: readonly string[];
}

export interface SupplierCapabilities {
  readonly productImport: boolean;
  readonly freightQuote: boolean;
  readonly orderCreate: boolean;
  readonly orderPay: boolean;
  readonly tracking: boolean;
  readonly privateLabel: boolean;
}

export interface SupplierConnector {
  readonly provider: string;
  readonly capabilities: SupplierCapabilities;
  resolveProductUrl(sourceUrl: string): Promise<SupplierProductRef>;
  getProduct(reference: SupplierProductRef): Promise<SupplierProductRef>;
  collectProduct(reference: SupplierProductRef): Promise<SupplierProductSource>;
  normalizeProduct(source: SupplierProductSource): NormalizedSupplierProduct;
  getVariants(
    reference: SupplierProductRef,
  ): Promise<readonly SupplierVariant[]>;
  getPrice(reference: SupplierProductRef, supplierSku: string): Promise<Money>;
  getAvailability(
    reference: SupplierProductRef,
    supplierSku: string,
  ): Promise<Availability>;
  getShippingQuote(
    reference: SupplierProductRef,
    supplierSku: string,
    destinationCountry: string,
  ): Promise<ShippingQuote>;
  createOrder(draft: SupplierOrderDraft): Promise<SupplierOrder>;
  getOrder(supplierOrderId: string): Promise<SupplierOrder>;
  getTracking(supplierOrderId: string): Promise<Tracking>;
  supportsPrivateLabel(reference: SupplierProductRef): Promise<boolean>;
  getBrandingOptions(reference: SupplierProductRef): Promise<BrandingOptions>;
}
