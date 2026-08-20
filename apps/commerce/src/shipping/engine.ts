import type {
  DutiesMode,
  ProviderShippingQuote,
  PublicShippingMethodDTO,
  PublicShippingQuoteDTO,
  ShippingQuoteProvider,
  ShippingQuoteRequest,
  ShippingRoutingCandidate,
  SupplierRoutingResult,
} from "@achilles/domain";
import { parseFeatureFlags } from "@achilles/config";
import type { MedusaContainer } from "@medusajs/framework/types";
import { DecimalValue } from "../lib/decimal";
import { PublicCatalogService } from "../catalog/service";
import { PublicCartService } from "../cart/public-cart";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import type SupplierDomainModuleService from "../modules/supplier-domain/service";
import { recordAudit } from "../api/admin/achilles/audit";
import { ManualFxRateProvider } from "../pricing/engine";
import { normalizeBrazilPostalCode } from "./postal-code";
import {
  AlibabaShippingQuoteProvider,
  CJShippingQuoteProvider,
  ManualShippingQuoteProvider,
  ShippingProviderUnavailableError,
  type ManualShippingMethod,
} from "./providers";
import {
  executeWithProviderResilience,
  ProviderHealthTracker,
  ShortTtlCache,
} from "./resilience";
import { ShippingPolicy } from "./policy";
import { SupplierRouter } from "./supplier-router";
import { buildShippingGroups, shipmentTypeForGroups } from "./shipping-groups";

type VariantMap = { store_variant_id: string; supplier_sku: string };
type CostQuote = {
  fx_rate?: string | null;
  fx_source?: string | null;
  fx_captured_at?: Date | string | null;
};
type SupplierRecord = {
  id: string;
  provider: string;
  country_code: string;
  status: string;
};
type OfferRecord = {
  id: string;
  product_id: string;
  supplier_product_id: string;
  currency: string;
  unit_cost: string;
  availability: string;
  status: string;
  fulfillment_mode:
    "PRIVATE_LABEL_DROPSHIP" | "GENERIC_DROPSHIP" | "BRAZIL_STOCK";
  private_label_supported: boolean;
  is_primary: boolean;
  freight_metadata?: unknown;
  supplier?: SupplierRecord;
  variant_maps?: VariantMap[];
  cost_quotes?: CostQuote[];
};
type ProductPolicy = { fulfillment_mode: OfferRecord["fulfillment_mode"] };
type PersistedQuote = { id: string; expires_at: Date | string; status: string };

type ShippingDomainService = SupplierDomainModuleService & {
  listSupplierOffers(
    filters: { product_id: string; status: string },
    config: { relations: string[] },
  ): Promise<OfferRecord[]>;
  listProductPolicies(filters: {
    product_id: string;
  }): Promise<ProductPolicy[]>;
  listShippingQuotes(
    filters: Record<string, unknown>,
  ): Promise<PersistedQuote[]>;
  createShippingQuotes(input: Record<string, unknown>): Promise<PersistedQuote>;
  updateShippingQuotes(input: Record<string, unknown>): Promise<PersistedQuote>;
  createSupplierRoutingDecisions(
    input: Record<string, unknown>,
  ): Promise<{ id: string }>;
};

export class ShippingQuoteEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ShippingQuoteEngineError";
  }
}

export type ShippingEngineResult = {
  publicQuote: PublicShippingQuoteDTO;
  routing: SupplierRoutingResult;
  candidates: readonly ShippingRoutingCandidate[];
};

export type CheckoutShippingQuoteResult = {
  groups: Array<{
    id: string;
    label: string;
    itemLabels: string[];
    methods: PublicShippingMethodDTO[];
    selectedMethodId: null;
  }>;
  shipmentType: "SINGLE" | "MULTI_SHIPMENT";
};

const providerCache = new ShortTtlCache<readonly ProviderShippingQuote[]>(
  60_000,
);
const providerHealth = new ProviderHealthTracker();

export class ShippingQuoteEngine {
  private readonly service: ShippingDomainService;
  private readonly catalog: PublicCatalogService;
  private readonly policy = new ShippingPolicy();
  private readonly router = new SupplierRouter();
  private readonly flags = parseFeatureFlags(process.env);

  constructor(private readonly container: MedusaContainer) {
    this.service = container.resolve<ShippingDomainService>(
      SUPPLIER_DOMAIN_MODULE,
    );
    this.catalog = new PublicCatalogService(container);
  }

  async quoteProduct(input: {
    variantId: string;
    quantity: number;
    postalCode: string;
    cartId?: string | undefined;
    state?: string | undefined;
    city?: string | undefined;
  }): Promise<ShippingEngineResult> {
    const postalCode = normalizeBrazilPostalCode(input.postalCode);
    const product = await this.catalog.getProductByVariantId(input.variantId);
    const variant = product?.variants.find(
      (item) => item.id === input.variantId,
    );
    if (!product || !variant)
      throw new ShippingQuoteEngineError(
        "PRODUCT_NOT_PUBLIC",
        "Produto indisponível para cotação pública",
      );
    if (!variant.available)
      throw new ShippingQuoteEngineError(
        "VARIANT_UNAVAILABLE",
        "Variante indisponível",
      );

    await this.expirePriorQuotes(input.variantId, postalCode);
    const [offers, policies] = await Promise.all([
      this.service.listSupplierOffers(
        { product_id: product.id, status: "ACTIVE" },
        { relations: ["supplier", "variant_maps", "cost_quotes"] },
      ),
      this.service.listProductPolicies({ product_id: product.id }),
    ]);
    const requiredMode =
      policies[0]?.fulfillment_mode ?? "PRIVATE_LABEL_DROPSHIP";
    const candidates: ShippingRoutingCandidate[] = [];
    const quoteDetails = new Map<string, ProviderShippingQuote>();

    for (const offer of offers) {
      const variantMap = offer.variant_maps.find(
        (item) => item.store_variant_id === input.variantId,
      );
      if (
        !variantMap ||
        offer.supplier.status !== "ACTIVE" ||
        offer.availability === "OUT_OF_STOCK"
      )
        continue;

      const request: ShippingQuoteRequest = {
        productId: product.id,
        variantId: input.variantId,
        providerProductId: offer.supplier_product_id,
        supplierOfferId: offer.id,
        supplierSku: variantMap.supplier_sku,
        quantity: input.quantity,
        originCountryCode: offer.supplier.country_code,
        destination: {
          countryCode: "BR",
          postalCode,
          state: input.state,
          city: input.city,
        },
      };
      const provider = this.providerForOffer(offer);
      const quotes = await this.obtainQuotes(provider, request, offer).catch(
        async (error: unknown) => {
          await this.persistUnavailableQuote({
            offer,
            request,
            cartId: input.cartId,
            provider: provider.provider,
            error,
          });
          return [];
        },
      );
      const fx = fxSnapshot(offer);
      for (const quote of quotes) {
        const normalized = normalizeCurrency(quote.amount, quote.currency, fx);
        const unitCost = normalizeCurrency(offer.unit_cost, offer.currency, fx);
        const status = shippingQuoteStatus(
          quote.expiresAt,
          Boolean(normalized && unitCost),
        );
        const persisted = await this.service.createShippingQuotes({
          cart_id: input.cartId ?? null,
          product_id: product.id,
          variant_id: input.variantId,
          supplier_offer_id: offer.id,
          provider: quote.provider,
          destination_country: "BR",
          destination_state: input.state ?? null,
          destination_city: input.city ?? null,
          postal_code: postalCode,
          quantity: input.quantity,
          provider_service_code: quote.serviceCode,
          method_name: quote.methodName,
          currency: quote.currency.toUpperCase(),
          provider_amount: quote.amount,
          normalized_amount_brl: normalized,
          fx_rate: fx?.rate ?? null,
          fx_source: fx?.source ?? null,
          fx_captured_at: fx ? new Date(fx.timestamp) : null,
          estimated_min_days: quote.estimatedMinimumDays,
          estimated_max_days: quote.estimatedMaximumDays,
          estimate_source: quote.provider,
          duties_mode: quote.dutiesMode,
          tracking_supported: quote.trackingSupported,
          expires_at: new Date(quote.expiresAt),
          status,
          warnings: {
            items:
              status === "VALID"
                ? quote.warnings
                : status === "EXPIRED"
                  ? [...quote.warnings, "Cotação expirada"]
                  : [...quote.warnings, "FX válido não disponível"],
          },
          assumptions: { items: quote.assumptions },
          provider_reference: quote.providerReference,
        });
        await recordAudit(this.service, {
          action:
            status === "VALID"
              ? "SHIPPING_QUOTE_RECEIVED"
              : "SHIPPING_QUOTE_UNAVAILABLE",
          entityType: "shipping_quote",
          entityId: persisted.id,
          actorId: null,
          summary:
            status === "VALID"
              ? "Cotação logística registrada"
              : "Cotação sem FX válido registrada como indisponível",
          metadata: { provider: quote.provider, product_id: product.id },
        });
        if (status !== "VALID" || !normalized || !unitCost) continue;
        const delivered = DecimalValue.parse(unitCost)
          .multiply(DecimalValue.parse(String(input.quantity)))
          .add(DecimalValue.parse(normalized))
          .toFixed(2);
        const candidate: ShippingRoutingCandidate = {
          supplierOfferId: offer.id,
          provider: quote.provider,
          quoteId: persisted.id,
          serviceCode: quote.serviceCode,
          supplierUnitCostBrl: unitCost,
          shippingCostBrl: normalized,
          deliveredSupplierCostBrl: delivered,
          estimatedMinimumDays: quote.estimatedMinimumDays,
          estimatedMaximumDays: quote.estimatedMaximumDays,
          isPrimary: offer.is_primary,
          available: true,
          privateLabelSupported: offer.private_label_supported,
          fulfillmentMode: offer.fulfillment_mode,
          dutiesMode: quote.dutiesMode,
          warnings: quote.warnings,
        };
        candidates.push(candidate);
        quoteDetails.set(persisted.id, quote);
      }
    }

    const routing = this.router.route(candidates, {
      privateLabelRequired: requiredMode === "PRIVATE_LABEL_DROPSHIP",
      preferBrazilStockWhenCompetitive:
        this.flags.PREFER_BRAZIL_STOCK_WHEN_COMPETITIVE,
    });
    await this.persistRoutingDecision({
      productId: product.id,
      variantId: input.variantId,
      postalCode,
      cartId: input.cartId,
      routing,
      candidates,
    });
    const selectedOfferId = routing.recommended?.supplierOfferId;
    const selectedCandidates = selectedOfferId
      ? candidates.filter((item) => item.supplierOfferId === selectedOfferId)
      : [];
    const methods = selectedCandidates
      .map((candidate) =>
        this.toPublicMethod(
          candidate,
          quoteDetails.get(candidate.quoteId),
          variant.price.amount * input.quantity,
        ),
      )
      .filter((item): item is PublicShippingMethodDTO => Boolean(item))
      .sort((left, right) => left.price.amount - right.price.amount);
    if (routing.recommended)
      await recordAudit(this.service, {
        action: "SHIPPING_POLICY_APPLIED",
        entityType: "shipping_quote",
        entityId: routing.recommended.quoteId,
        actorId: null,
        summary: "Política PASS_THROUGH aplicada à cotação pública",
        metadata: { rule: "PASS_THROUGH" },
      });
    return {
      publicQuote: {
        destinationPostalCode: postalCode,
        shipmentType: "SINGLE",
        methods,
        message: methods.length
          ? null
          : "Não há cotação configurada para este produto e CEP no momento.",
        expiresAt:
          selectedCandidates
            .map((item) => quoteDetails.get(item.quoteId)?.expiresAt)
            .filter((item): item is string => Boolean(item))
            .sort()[0] ?? null,
      },
      routing,
      candidates,
    };
  }

  async quoteCart(input: {
    cartId: string;
    postalCode: string;
    state?: string | undefined;
    city?: string | undefined;
  }): Promise<ShippingEngineResult> {
    const cart = await new PublicCartService(this.container).retrieve(
      input.cartId,
    );
    if (cart.items.length === 0)
      return {
        publicQuote: {
          destinationPostalCode: normalizeBrazilPostalCode(input.postalCode),
          shipmentType: "SINGLE",
          methods: [],
          message: "Adicione um produto para calcular a entrega.",
          expiresAt: null,
        },
        routing: {
          recommended: null,
          alternatives: [],
          reason: "Cotação consolidada indisponível para este carrinho",
          scores: {},
        },
        candidates: [],
      };
    if (cart.items.length > 1) {
      const results = await Promise.all(
        cart.items.map((item) =>
          this.quoteProduct({
            variantId: item.variantId,
            quantity: item.quantity,
            postalCode: input.postalCode,
            cartId: cart.id,
            state: input.state,
            city: input.city,
          }),
        ),
      );
      const destination = {
        countryCode: "BR",
        postalCode: normalizeBrazilPostalCode(input.postalCode),
      };
      const groups = buildShippingGroups(
        results.flatMap((result, index) => {
          const selected = result.routing.recommended;
          const item = cart.items[index];
          return selected && item
            ? [
                {
                  variantId: item.variantId,
                  supplierOfferId: selected.supplierOfferId,
                  provider: selected.provider,
                  quoteId: selected.quoteId,
                },
              ]
            : [];
        }),
        destination,
      );
      const shipmentType = shipmentTypeForGroups(groups);
      return {
        publicQuote: {
          destinationPostalCode: destination.postalCode,
          shipmentType,
          methods: [],
          message:
            shipmentType === "MULTI_SHIPMENT"
              ? "Este carrinho terá mais de uma remessa. As opções serão confirmadas no checkout."
              : "A consolidação desta remessa será confirmada no checkout.",
          expiresAt: null,
        },
        routing: {
          recommended: null,
          alternatives: [],
          reason: `${String(groups.length)} grupo(s) de remessa calculado(s) sem soma silenciosa`,
          scores: {},
        },
        candidates: results.flatMap((result) => result.candidates),
      };
    }
    const item = cart.items[0];
    if (!item)
      throw new ShippingQuoteEngineError("EMPTY_CART", "Carrinho vazio");
    return this.quoteProduct({
      variantId: item.variantId,
      quantity: item.quantity,
      postalCode: input.postalCode,
      cartId: cart.id,
      state: input.state,
      city: input.city,
    });
  }

  async quoteCheckoutCart(input: {
    cartId: string;
    postalCode: string;
    state: string;
    city: string;
  }): Promise<CheckoutShippingQuoteResult> {
    const cart = await new PublicCartService(this.container).retrieve(
      input.cartId,
    );
    if (cart.items.length === 0)
      throw new ShippingQuoteEngineError("EMPTY_CART", "Carrinho vazio");
    const results = await Promise.all(
      cart.items.map((item) =>
        this.quoteProduct({
          variantId: item.variantId,
          quantity: item.quantity,
          postalCode: input.postalCode,
          state: input.state,
          city: input.city,
          cartId: cart.id,
        }),
      ),
    );
    const groups = results.map((result, index) => {
      const cartItem = cart.items[index];
      return {
        id: `group-${String(index + 1)}`,
        label: `Pacote ${String(index + 1)}`,
        itemLabels: [cartItem?.productTitle ?? "Produto"],
        methods: [...result.publicQuote.methods],
        selectedMethodId: null,
      };
    });
    return {
      groups,
      shipmentType: groups.length > 1 ? "MULTI_SHIPMENT" : "SINGLE",
    };
  }

  private providerForOffer(offer: OfferRecord): ShippingQuoteProvider {
    const manual = manualMethods(offer.freight_metadata);
    if (manual.length) return new ManualShippingQuoteProvider(manual);
    if (offer.supplier?.provider === "ALIBABA")
      return new AlibabaShippingQuoteProvider(this.flags.ALIBABA_FREIGHT_QUOTE);
    if (offer.supplier?.provider === "CJ")
      return new CJShippingQuoteProvider(this.flags.CJ_SHIPPING);
    return new ManualShippingQuoteProvider([]);
  }

  private async obtainQuotes(
    provider: ShippingQuoteProvider,
    request: ShippingQuoteRequest,
    offer: OfferRecord,
  ): Promise<readonly ProviderShippingQuote[]> {
    if (
      !provider.supportsDestination(request.destination) ||
      !provider.supportsProduct(request)
    )
      throw new ShippingProviderUnavailableError(
        provider.provider,
        "Provider não suporta o destino/produto",
      );
    const key = [
      provider.provider,
      offer.id,
      request.variantId,
      request.quantity,
      request.destination.postalCode,
      request.destination.state ?? "",
      request.destination.city ?? "",
    ].join(":");
    const cached = providerCache.get(key);
    if (cached) return cached;
    try {
      const quotes = await executeWithProviderResilience(
        () => provider.quote(request),
        { timeoutMs: 4_000, retries: 1 },
      );
      providerHealth.success(provider.provider);
      providerCache.set(key, quotes, 30_000);
      return quotes;
    } catch (error) {
      providerHealth.failure(provider.provider);
      throw error;
    }
  }

  private async expirePriorQuotes(variantId: string, postalCode: string) {
    const quotes = await this.service.listShippingQuotes({
      variant_id: variantId,
      postal_code: postalCode,
      status: "VALID",
    });
    const now = Date.now();
    for (const quote of quotes) {
      if (new Date(quote.expires_at).getTime() <= now)
        await this.service.updateShippingQuotes({
          id: quote.id,
          status: "EXPIRED",
        });
    }
  }

  private async persistUnavailableQuote(input: {
    offer: OfferRecord;
    request: ShippingQuoteRequest;
    cartId?: string | undefined;
    provider: string;
    error: unknown;
  }): Promise<void> {
    const message =
      input.error instanceof Error
        ? input.error.message
        : "Provider indisponível";
    const unavailable = input.error instanceof ShippingProviderUnavailableError;
    const quote = await this.service.createShippingQuotes({
      cart_id: input.cartId ?? null,
      product_id: input.request.productId,
      variant_id: input.request.variantId,
      supplier_offer_id: input.offer.id,
      provider: input.provider,
      destination_country: "BR",
      destination_state: null,
      destination_city: null,
      postal_code: input.request.destination.postalCode,
      quantity: input.request.quantity,
      provider_service_code: "UNAVAILABLE",
      method_name: "Indisponível",
      currency: input.offer.currency,
      provider_amount: "0",
      normalized_amount_brl: null,
      fx_rate: null,
      fx_source: null,
      fx_captured_at: null,
      estimated_min_days: 0,
      estimated_max_days: 0,
      estimate_source: input.provider,
      duties_mode: "UNKNOWN",
      tracking_supported: false,
      expires_at: new Date(),
      status: unavailable ? "UNAVAILABLE" : "FAILED",
      warnings: { items: [message] },
      assumptions: { items: [] },
      provider_reference: null,
    });
    await recordAudit(this.service, {
      action: "SHIPPING_QUOTE_FAILED",
      entityType: "shipping_quote",
      entityId: quote.id,
      actorId: null,
      summary: message,
      metadata: { provider: input.provider },
    });
  }

  private async persistRoutingDecision(input: {
    productId: string;
    variantId: string;
    postalCode: string;
    cartId?: string | undefined;
    routing: SupplierRoutingResult;
    candidates: readonly ShippingRoutingCandidate[];
  }): Promise<void> {
    const decision = await this.service.createSupplierRoutingDecisions({
      cart_id: input.cartId ?? null,
      product_id: input.productId,
      variant_id: input.variantId,
      destination_country: "BR",
      postal_code: input.postalCode,
      selected_supplier_offer_id:
        input.routing.recommended?.supplierOfferId ?? null,
      selected_shipping_quote_id: input.routing.recommended?.quoteId ?? null,
      candidates: { items: input.candidates },
      scores: input.routing.scores,
      reasons: { items: [input.routing.reason] },
      quote_references: {
        items: input.candidates.map((candidate) => candidate.quoteId),
      },
      decided_at: new Date(),
    });
    await recordAudit(this.service, {
      action: "SUPPLIER_ROUTING_DECIDED",
      entityType: "supplier_routing_decision",
      entityId: decision.id,
      actorId: null,
      summary: input.routing.reason,
      metadata: {
        selected_offer_id: input.routing.recommended?.supplierOfferId ?? null,
      },
    });
  }

  private toPublicMethod(
    candidate: ShippingRoutingCandidate,
    providerQuote: ProviderShippingQuote | undefined,
    subtotalBrl: number,
  ): PublicShippingMethodDTO | null {
    if (!providerQuote) return null;
    const applied = this.policy.apply({
      providerCostBrl: candidate.shippingCostBrl,
      cartSubtotalBrl: subtotalBrl.toFixed(2),
      configuration: {
        strategy: "PASS_THROUGH",
        assumptions: ["Custo de frete repassado sem subsídio nesta etapa"],
      },
    });
    const amount = Number(applied.customerShippingPrice);
    return {
      id: candidate.quoteId,
      name: providerQuote.methodName,
      price: {
        amount,
        currencyCode: "brl",
        formatted: new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(amount),
      },
      estimatedMinimumDays: candidate.estimatedMinimumDays,
      estimatedMaximumDays: candidate.estimatedMaximumDays,
      trackingSupported: providerQuote.trackingSupported,
      dutiesNotice: dutiesNotice(candidate.dutiesMode),
    };
  }
}

function fxSnapshot(offer: OfferRecord) {
  const quote = offer.cost_quotes?.find(
    (item) => item.fx_rate && item.fx_source && item.fx_captured_at,
  );
  if (!quote?.fx_rate || !quote.fx_source || !quote.fx_captured_at) return null;
  const capturedAt = new Date(quote.fx_captured_at);
  if (
    !Number.isFinite(capturedAt.getTime()) ||
    Date.now() - capturedAt.getTime() > 24 * 60 * 60 * 1_000
  )
    return null;
  return new ManualFxRateProvider(
    quote.fx_rate,
    quote.fx_source,
    capturedAt.toISOString(),
  ).snapshot();
}

function normalizeCurrency(
  amount: string,
  currency: string,
  fx: { rate: string; source: string; timestamp: string } | null,
): string | null {
  if (currency.toUpperCase() === "BRL")
    return DecimalValue.parse(amount).toFixed(2);
  if (currency.toUpperCase() !== "USD" || !fx) return null;
  return DecimalValue.parse(amount)
    .multiply(DecimalValue.parse(fx.rate))
    .toFixed(2);
}

function manualMethods(value: unknown): ManualShippingMethod[] {
  if (!isRecord(value) || !Array.isArray(value.shipping_methods)) return [];
  return value.shipping_methods.flatMap((item) => {
    if (!isRecord(item)) return [];
    const duties = item.duties_mode;
    if (
      typeof item.service_code !== "string" ||
      typeof item.method_name !== "string" ||
      typeof item.currency !== "string" ||
      typeof item.amount !== "string" ||
      typeof item.estimated_min_days !== "number" ||
      typeof item.estimated_max_days !== "number" ||
      !["DDP", "DAP", "UNKNOWN"].includes(String(duties)) ||
      !Array.isArray(item.assumptions) ||
      !item.assumptions.every((entry) => typeof entry === "string")
    )
      return [];
    return [
      {
        serviceCode: item.service_code,
        methodName: item.method_name,
        currency: item.currency,
        amount: item.amount,
        estimatedMinimumDays: item.estimated_min_days,
        estimatedMaximumDays: item.estimated_max_days,
        trackingSupported: item.tracking_supported === true,
        dutiesMode: duties as DutiesMode,
        warnings: Array.isArray(item.warnings)
          ? item.warnings.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
        assumptions: item.assumptions,
        ttlSeconds:
          typeof item.ttl_seconds === "number" ? item.ttl_seconds : 300,
        reference:
          typeof item.reference === "string" ? item.reference : undefined,
      },
    ];
  });
}

function dutiesNotice(mode: DutiesMode): string {
  if (mode === "DDP") return "Tributos informados pelo método como incluídos.";
  if (mode === "DAP")
    return "Tributos de importação podem ser cobrados no destino.";
  return "O tratamento de tributos será confirmado antes da compra.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function shippingQuoteStatus(
  expiresAt: string,
  normalized: boolean,
  now = Date.now(),
): "VALID" | "EXPIRED" | "UNAVAILABLE" {
  if (new Date(expiresAt).getTime() <= now) return "EXPIRED";
  return normalized ? "VALID" : "UNAVAILABLE";
}
