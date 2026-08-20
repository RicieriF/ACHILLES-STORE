import type { ShippingDestination, ShippingGroup } from "@achilles/domain";

export function buildShippingGroups(
  items: ReadonlyArray<{
    variantId: string;
    supplierOfferId: string;
    provider: string;
    quoteId: string;
  }>,
  destination: ShippingDestination,
): ShippingGroup[] {
  const grouped = new Map<string, ShippingGroup>();
  for (const item of items) {
    const key = `${item.provider}:${item.supplierOfferId}`;
    const current = grouped.get(key);
    grouped.set(key, {
      id: current?.id ?? `group-${String(grouped.size + 1)}`,
      supplierOfferId: item.supplierOfferId,
      provider: item.provider,
      itemVariantIds: [...(current?.itemVariantIds ?? []), item.variantId],
      destination,
      quoteIds: [...(current?.quoteIds ?? []), item.quoteId],
      selectedQuoteId: current?.selectedQuoteId ?? item.quoteId,
    });
  }
  return [...grouped.values()];
}

export function shipmentTypeForGroups(
  groups: readonly ShippingGroup[],
): "SINGLE" | "MULTI_SHIPMENT" {
  return groups.length > 1 ? "MULTI_SHIPMENT" : "SINGLE";
}
