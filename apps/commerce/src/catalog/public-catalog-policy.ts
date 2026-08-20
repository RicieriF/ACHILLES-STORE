export type CatalogProductCandidate = {
  status: string;
  title: string | null;
  handle: string | null;
  description: string | null;
  salesChannelIds: readonly string[];
  variantIds: readonly string[];
  variantPrices: readonly number[];
  categoryIds: readonly string[];
  blocked: boolean;
};

export type CatalogPolicyCandidate = {
  complianceStatus: string;
  commercialReadiness: string;
} | null;

export type CatalogOfferCandidate = {
  status: string;
  primary: boolean;
} | null;

export type CatalogPriceCandidate = {
  status: string;
  approvedAt: string | Date | null;
  approvedBy: string | null;
  approvedRetailPrice: string | null;
  approvedSnapshotId: string | null;
} | null;

export type PublicCatalogDecision =
  | { eligible: true; approvedPrice: number }
  | { eligible: false; reasons: string[] };

export class PublicCatalogPolicy {
  evaluate(input: {
    product: CatalogProductCandidate;
    policy: CatalogPolicyCandidate;
    offer: CatalogOfferCandidate;
    price: CatalogPriceCandidate;
    publicSalesChannelId: string;
  }): PublicCatalogDecision {
    const reasons: string[] = [];
    const { product, policy, offer, price, publicSalesChannelId } = input;

    if (product.status !== "published") reasons.push("PRODUCT_NOT_PUBLISHED");
    if (!product.salesChannelIds.includes(publicSalesChannelId))
      reasons.push("PUBLIC_SALES_CHANNEL_MISSING");
    if (product.blocked) reasons.push("PRODUCT_BLOCKED");
    if (!product.title?.trim() || !product.handle?.trim())
      reasons.push("PRESENTATION_DATA_MISSING");
    if (!product.description?.trim()) reasons.push("DESCRIPTION_MISSING");
    if (product.variantIds.length === 0) reasons.push("VARIANT_MISSING");
    if (product.categoryIds.length === 0) reasons.push("CATEGORY_MISSING");
    if (!policy) reasons.push("POLICY_MISSING");
    if (policy && policy.complianceStatus !== "CLEAR")
      reasons.push("COMPLIANCE_NOT_CLEAR");
    if (policy && policy.commercialReadiness !== "READY_FOR_REVIEW")
      reasons.push("COMMERCIAL_READINESS_NOT_ALLOWED");
    if (!offer || offer.status !== "ACTIVE" || !offer.primary)
      reasons.push("PRIMARY_OFFER_NOT_ACTIVE");
    if (!price) reasons.push("APPROVED_PRICE_MISSING");
    if (price?.status === "STALE") reasons.push("PRICE_STALE");
    if (price && price.status !== "PRICED") reasons.push("PRICE_NOT_CURRENT");
    if (
      price &&
      (!price.approvedAt ||
        !price.approvedBy ||
        !price.approvedSnapshotId ||
        !price.approvedRetailPrice)
    )
      reasons.push("PRICE_NOT_APPROVED");

    const approvedPrice = Number(price?.approvedRetailPrice);
    if (!Number.isFinite(approvedPrice) || approvedPrice <= 0)
      reasons.push("COMMERCIAL_PRICE_INVALID");
    if (
      product.variantPrices.length !== product.variantIds.length ||
      product.variantPrices.some((amount) => amount !== approvedPrice)
    )
      reasons.push("CORE_PRICE_NOT_APPROVED");

    return reasons.length > 0
      ? { eligible: false, reasons }
      : { eligible: true, approvedPrice };
  }
}
