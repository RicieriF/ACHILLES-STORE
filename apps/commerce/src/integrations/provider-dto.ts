type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const text = (...values: unknown[]): string | null => {
  for (const value of values)
    if (typeof value === "string" || typeof value === "number")
      return String(value);
  return null;
};
const number = (value: unknown): number | null =>
  Number.isFinite(Number(value)) ? Number(value) : null;

export type ProviderProductCard = {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  priceMin: string | null;
  priceMax: string | null;
  currency: string | null;
  supplier: string | null;
  moq: number | null;
};

export function normalizeCJList(payload: unknown): {
  items: ProviderProductCard[];
  total: number;
} {
  const root = record(payload);
  const data = record(root.data);
  const list = array(data.list ?? data.content ?? root.list);
  return {
    items: list.flatMap((value) => {
      const item = record(value);
      const id = text(item.pid, item.productId, item.id);
      if (!id) return [];
      return [
        {
          id,
          title:
            text(item.productNameEn, item.productName, item.name) ?? `CJ ${id}`,
          sku: text(item.productSku, item.sku),
          image: text(item.productImage, item.bigImage, item.image),
          priceMin: text(item.sellPrice, item.discountPrice, item.price),
          priceMax: text(item.maxSellPrice, item.sellPrice, item.price),
          currency: text(item.currency) ?? "USD",
          supplier: null,
          moq: null,
        },
      ];
    }),
    total: Number(data.total ?? data.totalRecords ?? root.total ?? list.length),
  };
}

export function normalizeCJProduct(payload: unknown): JsonRecord {
  const item = record(record(payload).data);
  return {
    id: text(item.pid, item.productId, item.id),
    title: text(item.productNameEn, item.productName, item.name),
    sku: text(item.productSku, item.sku),
    description: text(item.description, item.productDescription),
    images: array(item.productImageSet ?? item.images).flatMap((value) => {
      const image = text(value);
      return image ? [image] : [];
    }),
    image: text(item.productImage, item.bigImage, item.image),
    price: text(item.sellPrice, item.price),
    currency: text(item.currency) ?? "USD",
    weight: text(item.productWeight, item.weight),
    dimensions: {
      length: text(item.productLength, item.length),
      width: text(item.productWidth, item.width),
      height: text(item.productHeight, item.height),
    },
  };
}

export function normalizeCJStock(payload: unknown) {
  return array(record(payload).data).map((value) => {
    const item = record(value);
    return {
      warehouse: text(item.areaEn, item.warehouseName, item.storeName),
      country: text(item.countryCode, item.country),
      quantity: number(item.totalInventoryNum ?? item.inventoryNum),
    };
  });
}

export function normalizeCJVariants(payload: unknown) {
  const root = record(payload);
  const values = Array.isArray(root.data)
    ? root.data
    : array(record(root.data).list);
  return values.flatMap((value) => {
    const item = record(value);
    const id = text(item.vid, item.variantId);
    const sku = text(item.variantSku, item.sku);
    if (!id || !sku) return [];
    return [
      {
        id,
        sku,
        title: text(item.variantNameEn, item.variantName, item.name) ?? sku,
        image: text(item.variantImage, item.image),
        price: text(item.variantSellPrice, item.sellPrice, item.price),
      },
    ];
  });
}

export function normalizeCJFreight(payload: unknown) {
  return array(record(payload).data).map((value) => {
    const item = record(value);
    return {
      method: text(item.logisticName, item.logisticNameCn, item.method),
      price: text(item.logisticPrice, item.price),
      currency: text(item.currency) ?? "USD",
      deliveryTime: text(item.logisticAging, item.deliveryTime),
    };
  });
}

const alibabaItems = (payload: unknown): unknown[] =>
  array(
    record(
      record(record(payload).alibaba_dropshipping_product_get_response).value,
    ).distribution_sale_product,
  );

export function normalizeAlibabaProducts(
  payload: unknown,
): ProviderProductCard[] {
  return alibabaItems(payload).flatMap((raw) => {
    const item = record(raw);
    const id = text(item.product_id);
    if (!id) return [];
    const moq = record(item.moq_and_price);
    const unitPrice = record(moq.moq_unit_price);
    const range = (text(item.price_range) ?? "").split("~");
    return [
      {
        id,
        title: text(item.name) ?? `Alibaba ${id}`,
        sku: null,
        image: text(item.main_image_url),
        priceMin: text(unitPrice.amount) ?? range[0] ?? null,
        priceMax: range[1] ?? range[0] ?? null,
        currency: text(unitPrice.currency) ?? "USD",
        supplier: text(item.supplier_name, item.company_name),
        moq: number(moq.min_order_quantity),
      },
    ];
  });
}

export function normalizeAlibabaProduct(payload: unknown): JsonRecord | null {
  const item = record(alibabaItems(payload)[0]);
  const card = normalizeAlibabaProducts(payload)[0];
  if (!card) return null;
  return {
    ...card,
    description: text(item.description),
    sourceUrl: text(item.detail_url),
    images: [item.main_image_url, ...array(item.product_image_list)].flatMap(
      (value) => {
        const image = text(value);
        return image ? [image] : [];
      },
    ),
    variants: array(item.product_sku_list).map((value) => {
      const sku = record(value);
      return {
        id: text(sku.sku_id, sku.id),
        sku: text(sku.sku_code, sku.sku_id),
        title: text(sku.sku_attr, sku.sku_code, sku.sku_id),
        inventory: number(sku.inventory),
        price: text(record(sku.sku_price).amount, sku.price),
      };
    }),
  };
}

export function normalizeAlibabaFreight(payload: unknown) {
  const response = record(
    record(payload).alibaba_shipping_freight_calculate_response,
  );
  const result = record(response.result ?? response.value);
  return array(result.freight).map((value) => {
    const quote = record(value);
    const fee = record(quote.fee);
    return {
      method: text(quote.vendor, quote.logistics_method),
      price: text(fee.amount, quote.amount),
      currency: text(fee.currency, quote.currency),
      deliveryTime: text(quote.delivery_time),
    };
  });
}

export function normalizeAlibabaTracking(payload: unknown) {
  const response = record(
    record(payload).alibaba_order_logistics_tracking_get_response,
  );
  const result = record(response.result ?? response.value);
  return {
    carrier: text(result.carrier_name, result.carrier),
    trackingNumber: text(result.tracking_number, result.logistics_no),
    trackingUrl: text(result.tracking_url),
    events: array(result.events).map((value) => {
      const event = record(value);
      return {
        status: text(event.status, event.description),
        occurredAt: text(event.event_time, event.time),
      };
    }),
  };
}
