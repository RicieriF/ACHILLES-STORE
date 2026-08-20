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
import {
  AlibabaUrlError,
  assertPublicAlibabaUrl,
  parseAlibabaUrl,
  productReference,
  validateRedirect,
} from "./url";

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
      orderCreate: flags.ALIBABA_ORDER_CREATE,
      orderPay: flags.ALIBABA_ORDER_PAY,
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
    const safeUrl = await assertPublicAlibabaUrl(reference.sourceUrl);
    const response = await retrySafe(async () => {
      const result = await fetchWithTimeout(
        safeUrl,
        {
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent":
              "AchillesStoreImporter/1.0 (+manual-review; no-automation)",
          },
          redirect: "manual",
        },
        8_000,
      );
      if (result.status >= 300 && result.status < 400)
        throw new AlibabaUrlError(
          "REDIRECT_BLOCKED",
          "Redirecionamento inesperado durante coleta",
        );
      if (result.status === 404)
        throw new AlibabaCollectionError(
          "PRODUCT_REMOVED",
          "Produto removido ou não encontrado",
        );
      if (result.status === 429)
        throw new AlibabaCollectionError(
          "RATE_LIMITED",
          "Fornecedor limitou temporariamente as consultas",
        );
      if (result.status === 401 || result.status === 403)
        throw new AlibabaCollectionError(
          "ACCESS_BLOCKED",
          "Acesso público bloqueado; use preenchimento manual",
        );
      if (!result.ok)
        throw new AlibabaCollectionError(
          "EXTERNAL_UNAVAILABLE",
          `Falha transitória do provedor (${String(result.status)})`,
          result.status >= 500,
        );
      return result;
    });
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 2_000_000)
      throw new Error("Resposta externa excede o limite seguro");
    const html = (await response.text()).slice(0, 2_000_000);
    const jsonLd = extractProductJsonLd(html);
    return {
      reference,
      title: stringValue(jsonLd?.name),
      description: stringValue(jsonLd?.description)?.slice(0, 8_000),
      currency: stringValue(
        jsonLd?.offers && objectValue(jsonLd.offers)?.priceCurrency,
      ),
      priceMin:
        stringValue(jsonLd?.offers && objectValue(jsonLd.offers)?.lowPrice) ??
        stringValue(jsonLd?.offers && objectValue(jsonLd.offers)?.price),
      priceMax: stringValue(
        jsonLd?.offers && objectValue(jsonLd.offers)?.highPrice,
      ),
      media: arrayStrings(jsonLd?.image).slice(0, 20),
      specifications: {},
      variants: [],
      metadata: { parser: "JSON_LD_ONLY", incomplete: true },
      obtainedAt: new Date().toISOString(),
      method: "PUBLIC_PAGE",
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
function extractProductJsonLd(
  html: string,
): Record<string, unknown> | undefined {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      // JSON.parse is the isolated untyped boundary for external JSON-LD.
      const parsed: unknown = JSON.parse(match[1] ?? "null");
      const candidates: unknown[] = Array.isArray(parsed)
        ? (parsed as unknown[])
        : [parsed];
      const product = candidates.find(
        (item) => objectValue(item)?.["@type"] === "Product",
      );
      if (product) return objectValue(product);
    } catch {
      continue;
    }
  }
  return undefined;
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
