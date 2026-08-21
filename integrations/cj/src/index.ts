import type { FeatureFlags } from "@achilles/config";
import type {
  Availability,
  BrandingOptions,
  Money,
  NormalizedSupplierProduct,
  ShippingQuote,
  SupplierCapabilities,
  SupplierConnector,
  SupplierOrder,
  SupplierOrderDraft,
  SupplierProductRef,
  SupplierProductSource,
  SupplierVariant,
  Tracking,
} from "@achilles/domain";

export * from "./client";

export class CJCapabilityDisabledError extends Error {
  constructor(capability: keyof SupplierCapabilities) {
    super(`CJ capability is disabled or not configured: ${capability}`);
    this.name = "CJCapabilityDisabledError";
  }
}

export type CJConnectorOptions = {
  testMode?: boolean;
  clock?: () => Date;
};

const fixtureReference: SupplierProductRef = {
  provider: "CJ",
  supplierProductId: "CJ-TEST-EDC-001",
  sourceUrl: "https://test.invalid/cj/CJ-TEST-EDC-001",
};

export class CJConnector implements SupplierConnector {
  readonly provider = "CJ";
  readonly capabilities: SupplierCapabilities;
  private readonly testMode: boolean;
  private readonly clock: () => Date;

  constructor(flags: FeatureFlags, options: CJConnectorOptions = {}) {
    this.testMode = options.testMode === true;
    if (
      this.testMode &&
      (process.env.APP_ENV ?? process.env.NODE_ENV) === "production"
    )
      throw new Error("CJ_TEST_PROVIDER_FORBIDDEN_IN_PRODUCTION");
    this.clock = options.clock ?? (() => new Date());
    this.capabilities = {
      productImport:
        this.testMode || (flags.CJ_ENABLED && flags.CJ_PRODUCT_IMPORT),
      freightQuote: this.testMode || (flags.CJ_ENABLED && flags.CJ_SHIPPING),
      orderCreate: false,
      orderPay: false,
      tracking: this.testMode || (flags.CJ_ENABLED && flags.CJ_TRACKING),
      privateLabel: false,
    };
  }

  resolveProductUrl(sourceUrl: string): Promise<SupplierProductRef> {
    if (this.testMode)
      return Promise.resolve({ ...fixtureReference, sourceUrl });
    return this.unavailable("productImport");
  }
  getProduct(reference: SupplierProductRef): Promise<SupplierProductRef> {
    return this.testMode
      ? Promise.resolve(reference)
      : this.unavailable("productImport");
  }
  collectProduct(
    reference: SupplierProductRef,
  ): Promise<SupplierProductSource> {
    if (!this.testMode) return this.unavailable("productImport");
    return Promise.resolve({
      reference,
      title: "Fixture CJ — organizador EDC",
      description:
        "Fixture offline para validação técnica. Não representa catálogo conectado.",
      currency: "USD",
      priceMin: "12.50",
      priceMax: "12.50",
      moq: 1,
      category: "EDC",
      media: [],
      specifications: { fixture: "offline" },
      variants: [
        {
          supplierSku: "CJ-TEST-BLACK",
          title: "Preto",
          attributes: { cor: "Preto" },
        },
      ],
      metadata: { sandbox: true },
      obtainedAt: this.clock().toISOString(),
      method: "MANUAL",
    });
  }
  normalizeProduct(source: SupplierProductSource): NormalizedSupplierProduct {
    return {
      source,
      title: source.title,
      description: source.description,
      currency: source.currency,
      priceMin: source.priceMin,
      priceMax: source.priceMax,
      moq: source.moq,
      categorySuggested: source.category,
      specifications: source.specifications,
      variants: source.variants,
      compliance: "REVIEW_REQUIRED",
      alerts: ["Fixture CJ offline; revisão humana obrigatória"],
      normalizerVersion: "cj-test-v1",
    };
  }
  getVariants(
    reference: SupplierProductRef,
  ): Promise<readonly SupplierVariant[]> {
    return this.collectProduct(reference).then((product) => product.variants);
  }
  getPrice(
    _reference: SupplierProductRef,
    _supplierSku: string,
  ): Promise<Money> {
    return this.testMode
      ? Promise.resolve({ amount: "12.50", currency: "USD" })
      : this.unavailable("productImport");
  }
  getAvailability(
    _reference: SupplierProductRef,
    _supplierSku: string,
  ): Promise<Availability> {
    return this.testMode
      ? Promise.resolve({
          available: true,
          quantity: 25,
          checkedAt: this.clock().toISOString(),
        })
      : this.unavailable("productImport");
  }
  getShippingQuote(
    _reference: SupplierProductRef,
    _supplierSku: string,
    destinationCountry: string,
  ): Promise<ShippingQuote> {
    if (!this.testMode || destinationCountry !== "BR")
      return this.unavailable("freightQuote");
    return Promise.resolve({
      cost: { amount: "8.40", currency: "USD" },
      estimatedDays: { minimum: 14, maximum: 28 },
      assumptions: ["Fixture offline CJ", "Impostos não garantidos"],
    });
  }
  createOrder(_draft: SupplierOrderDraft): Promise<SupplierOrder> {
    return this.unavailable("orderCreate");
  }
  getOrder(_supplierOrderId: string): Promise<SupplierOrder> {
    return this.unavailable("orderCreate");
  }
  getTracking(_supplierOrderId: string): Promise<Tracking> {
    return this.testMode
      ? Promise.resolve({
          carrier: "CJ TEST",
          trackingNumber: "CJ-TEST-TRACKING",
          events: [
            {
              occurredAt: this.clock().toISOString(),
              description: "Fixture em trânsito",
            },
          ],
        })
      : this.unavailable("tracking");
  }
  supportsPrivateLabel(_reference: SupplierProductRef): Promise<boolean> {
    return Promise.resolve(false);
  }
  getBrandingOptions(_reference: SupplierProductRef): Promise<BrandingOptions> {
    return Promise.resolve({
      supported: false,
      notes: ["Não validado nesta foundation"],
    });
  }
  private unavailable<T>(capability: keyof SupplierCapabilities): Promise<T> {
    return Promise.reject(new CJCapabilityDisabledError(capability));
  }
}
