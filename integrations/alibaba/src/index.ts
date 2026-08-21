import type { FeatureFlags } from "@achilles/config";
import type {
  Availability,
  BrandingOptions,
  Money,
  ShippingQuote,
  SupplierCapabilities,
  SupplierConnector,
  SupplierOrder,
  SupplierOrderDraft,
  SupplierProductRef,
  SupplierProductSource,
  NormalizedSupplierProduct,
  SupplierVariant,
  Tracking,
} from "@achilles/domain";
import { normalizeProduct } from "./normalize";
import { alibabaClientFromEnvironment } from "./client";
import {
  AlibabaUrlError,
  assertPublicAlibabaUrl,
  parseAlibabaUrl,
  productReference,
  validateRedirect,
} from "./url";

export * from "./client";

export { AlibabaUrlError, parseAlibabaUrl, validateRedirect } from "./url";
export { decimal, normalizeProduct, NORMALIZER_VERSION } from "./normalize";

export class AlibabaCapabilityDisabledError extends Error {
  constructor(capability: keyof SupplierCapabilities) {
    super(`Alibaba capability is disabled or not configured: ${capability}`);
    this.name = "AlibabaCapabilityDisabledError";
  }
}
export class AlibabaCollectionError extends Error {
  constructor(
    readonly code:
      | "PRODUCT_REMOVED"
      | "RATE_LIMITED"
      | "ACCESS_BLOCKED"
      | "EXTERNAL_UNAVAILABLE",
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AlibabaCollectionError";
  }
}

export class AlibabaConnector implements SupplierConnector {
  readonly provider = "ALIBABA";
  readonly capabilities: SupplierCapabilities;
  constructor(flags: FeatureFlags) {
    this.capabilities = {
      productImport: flags.ALIBABA_PRODUCT_IMPORT,
      freightQuote: flags.ALIBABA_FREIGHT_QUOTE,
      orderCreate: false,
      orderPay: false,
      tracking: flags.ALIBABA_TRACKING,
      privateLabel: false,
    };
  }
  async resolveProductUrl(sourceUrl: string): Promise<SupplierProductRef> {
    let current = this.capabilities.productImport
      ? await assertPublicAlibabaUrl(sourceUrl)
      : parseAlibabaUrl(sourceUrl);
    if (!current.pathname.startsWith("/x/")) return productReference(current);
    if (!this.capabilities.productImport) return productReference(current);
    for (let redirects = 0; redirects < 4; redirects += 1) {
      const response = await fetchWithTimeout(
        current,
        { method: "HEAD", redirect: "manual" },
        5_000,
      );
      if (response.status < 300 || response.status >= 400)
        return productReference(current);
      const location = response.headers.get("location");
      if (!location)
        throw new AlibabaUrlError(
          "REDIRECT_BLOCKED",
          "Redirecionamento sem destino",
        );
      current = validateRedirect(current, location);
      await assertPublicAlibabaUrl(current.toString());
    }
    throw new AlibabaUrlError(
      "REDIRECT_BLOCKED",
      "Número máximo de redirecionamentos excedido",
    );
  }
  getProduct(_reference: SupplierProductRef): Promise<SupplierProductRef> {
    if (!this.capabilities.productImport)
      return this.unavailable("productImport");
    return Promise.resolve(_reference);
  }
  async collectProduct(
    reference: SupplierProductRef,
  ): Promise<SupplierProductSource> {
    if (!this.capabilities.productImport)
      return this.unavailable("productImport");
    const payload = await alibabaClientFromEnvironment().product(
      reference.supplierProductId,
    );
    const root = objectValue(payload);
    const response = objectValue(
      root?.alibaba_dropshipping_product_get_response,
    );
    const value = objectValue(response?.value);
    const product = Array.isArray(value?.distribution_sale_product)
      ? objectValue(value.distribution_sale_product[0])
      : undefined;
    if (!product)
      throw new AlibabaCollectionError(
        "PRODUCT_REMOVED",
        "Produto não encontrado pela API oficial.",
      );
    const moq = objectValue(product.moq_and_price);
    const price = objectValue(moq?.moq_unit_price);
    return {
      reference,
      title: stringValue(product.name),
      description: stringValue(product.description)?.slice(0, 8_000),
      currency: stringValue(price?.currency),
      priceMin: stringValue(price?.amount),
      priceMax: stringValue(product.price_range)?.split("~")[1],
      moq: Number(moq?.min_order_quantity) || undefined,
      media: arrayStrings(product.product_image_list).slice(0, 20),
      specifications: {},
      variants: [],
      metadata: { source: "ALIBABA_OFFICIAL_API", incomplete: true },
      obtainedAt: new Date().toISOString(),
      method: "OFFICIAL_API",
    };
  }
  normalizeProduct(source: SupplierProductSource): NormalizedSupplierProduct {
    return normalizeProduct(source);
  }
  getVariants(
    _reference: SupplierProductRef,
  ): Promise<readonly SupplierVariant[]> {
    return this.unavailable("productImport");
  }
  getPrice(
    _reference: SupplierProductRef,
    _supplierSku: string,
  ): Promise<Money> {
    return this.unavailable("productImport");
  }
  getAvailability(
    _reference: SupplierProductRef,
    _supplierSku: string,
  ): Promise<Availability> {
    return this.unavailable("productImport");
  }
  getShippingQuote(
    _reference: SupplierProductRef,
    _supplierSku: string,
    _destinationCountry: string,
  ): Promise<ShippingQuote> {
    return this.unavailable("freightQuote");
  }
  createOrder(_draft: SupplierOrderDraft): Promise<SupplierOrder> {
    return this.unavailable("orderCreate");
  }
  getOrder(_supplierOrderId: string): Promise<SupplierOrder> {
    return this.unavailable("orderCreate");
  }
  getTracking(_supplierOrderId: string): Promise<Tracking> {
    return this.unavailable("tracking");
  }
  supportsPrivateLabel(_reference: SupplierProductRef): Promise<boolean> {
    return this.unavailable("privateLabel");
  }
  getBrandingOptions(_reference: SupplierProductRef): Promise<BrandingOptions> {
    return this.unavailable("privateLabel");
  }
  private unavailable<T>(capability: keyof SupplierCapabilities): Promise<T> {
    return Promise.reject(new AlibabaCapabilityDisabledError(capability));
  }
}

export async function fetchWithTimeout(
  url: URL,
  init: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
export async function retrySafe<T>(operation: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      last = error;
      if (
        (error as { retryable?: boolean }).retryable === false ||
        error instanceof AlibabaUrlError ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;
      if (attempt === 0)
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw last;
}
const objectValue = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
const arrayStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
