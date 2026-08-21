export const attentionReasons = [
  "SEM_IMAGEM",
  "SEM_PRECO",
  "SEM_FORNECEDOR",
  "SEM_ESTOQUE",
  "COMPLIANCE_REVIEW",
  "PRICE_STALE",
  "SHIPPING_STALE",
  "BLOCKED",
  "SUPPLIER_UNAVAILABLE",
] as const;

export type AttentionReason = (typeof attentionReasons)[number];
export type DropshippingStatus =
  | "READY"
  | "NEEDS_ATTENTION"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "SHIPPING_CHANGED"
  | "SUPPLIER_UNAVAILABLE"
  | "COMPLIANCE_HOLD";

export type OperationalProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  sku: string | null;
  category: string | null;
  categoryId: string | null;
  retailPrice: number | null;
  compareAtPrice: number | null;
  landedCost: number | null;
  marginPercent: number | null;
  stock: number | null;
  manageInventory: boolean;
  supplier: string | null;
  supplierId: string | null;
  supplierStatus?: string | null;
  offerStatus?: string | null;
  provider: string | null;
  origin: string | null;
  offerId: string | null;
  offerCount: number;
  availability: string | null;
  fulfillmentMode: string | null;
  compliance: string;
  commercialReadiness: string;
  pricingStatus: string | null;
  shippingStale: boolean;
  syncStatus: string | null;
  lastSyncAt: string | null;
  updatedAt: string;
  featured: boolean;
  attention: AttentionReason[];
  operationalStatus: DropshippingStatus;
  publicationEligible: boolean;
};

export type OperationalProductCandidate = Omit<
  OperationalProduct,
  "attention" | "operationalStatus" | "publicationEligible"
>;

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export function deriveAttention(
  product: OperationalProductCandidate,
): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (!product.thumbnail) reasons.push("SEM_IMAGEM");
  if (product.retailPrice === null || product.retailPrice <= 0)
    reasons.push("SEM_PRECO");
  if (product.offerCount === 0 || !product.offerId)
    reasons.push("SEM_FORNECEDOR");
  if (
    product.availability === "OUT_OF_STOCK" ||
    (product.manageInventory && (product.stock ?? 0) <= 0)
  )
    reasons.push("SEM_ESTOQUE");
  if (!["CLEAR", "BLOCKED"].includes(product.compliance))
    reasons.push("COMPLIANCE_REVIEW");
  if (product.compliance === "BLOCKED") reasons.push("BLOCKED");
  if (product.pricingStatus === "STALE" || product.syncStatus === "STALE")
    reasons.push("PRICE_STALE");
  if (product.shippingStale) reasons.push("SHIPPING_STALE");
  if (
    product.syncStatus === "FAILED" ||
    product.supplierStatus === "INACTIVE" ||
    product.offerStatus === "INACTIVE"
  )
    reasons.push("SUPPLIER_UNAVAILABLE");
  return unique(reasons);
}

export function deriveOperationalStatus(
  reasons: readonly AttentionReason[],
): DropshippingStatus {
  if (reasons.includes("BLOCKED") || reasons.includes("COMPLIANCE_REVIEW"))
    return "COMPLIANCE_HOLD";
  if (reasons.includes("SUPPLIER_UNAVAILABLE")) return "SUPPLIER_UNAVAILABLE";
  if (reasons.includes("SEM_ESTOQUE")) return "OUT_OF_STOCK";
  if (reasons.includes("PRICE_STALE")) return "PRICE_CHANGED";
  if (reasons.includes("SHIPPING_STALE")) return "SHIPPING_CHANGED";
  return reasons.length ? "NEEDS_ATTENTION" : "READY";
}

export function enrichOperationalProduct(
  candidate: OperationalProductCandidate,
): OperationalProduct {
  const attention = deriveAttention(candidate);
  return {
    ...candidate,
    attention,
    operationalStatus: deriveOperationalStatus(attention),
    publicationEligible:
      candidate.status === "published" &&
      candidate.compliance === "CLEAR" &&
      candidate.commercialReadiness === "READY_FOR_REVIEW" &&
      candidate.pricingStatus === "PRICED" &&
      candidate.offerId !== null &&
      attention.length === 0,
  };
}

export const attentionPriority: Readonly<Record<AttentionReason, number>> = {
  BLOCKED: 0,
  SUPPLIER_UNAVAILABLE: 1,
  COMPLIANCE_REVIEW: 2,
  SEM_FORNECEDOR: 3,
  SEM_PRECO: 4,
  SEM_ESTOQUE: 5,
  PRICE_STALE: 6,
  SHIPPING_STALE: 7,
  SEM_IMAGEM: 8,
};
