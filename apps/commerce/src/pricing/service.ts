import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows";
import { recordAudit, safeSnapshot } from "../api/admin/achilles/audit";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import type SupplierDomainModuleService from "../modules/supplier-domain/service";
import {
  calculatePricing,
  PRICING_ENGINE_VERSION,
  type PricingInputs,
} from "./engine";
import { ConfiguredImportTaxStrategy } from "./tax-strategy";

const activeCalculations = new Set<string>();

export class PricingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export type PricingAssumptions = Omit<
  PricingInputs,
  "sourceCurrency" | "supplierUnitCost" | "moq"
>;

export async function updatePricingAssumptions(
  container: MedusaContainer,
  quoteId: string,
  input: PricingAssumptions,
  actorId: string | null,
) {
  const service = resolveService(container);
  const quote = await retrieveQuote(service, quoteId);
  const wasCalculated = ["PRICED", "STALE"].includes(quote.status);
  const quoteAfter = await service.updateCostQuotes({
    id: quote.id,
    fx_rate: input.fxRate,
    fx_source: input.fxSource,
    fx_captured_at: new Date(input.fxTimestamp),
    international_freight: input.internationalShipping,
    international_shipping_allocation_method:
      input.internationalShippingAllocationMethod,
    shipping_allocation_quantity: input.shippingAllocationQuantity,
    customs_tax: input.customsTaxEstimate,
    customs_strategy: input.customsStrategy,
    branding_cost: input.brandingUnitCost,
    branding_setup_cost: input.brandingSetupCost,
    branding_setup_allocation: input.brandingSetupAllocationQuantity,
    payment_fee: input.paymentGatewayFixed,
    payment_gateway_percent: input.paymentGatewayPercent,
    payment_gateway_provider: input.paymentGatewayProvider,
    local_delivery: input.localDeliveryCost,
    risk_reserve: input.returnsRiskReserveFixed,
    returns_risk_reserve_percent: input.returnsRiskReservePercent,
    operational_reserve: input.operationalReserveFixed,
    operational_reserve_percent: input.operationalReservePercent,
    target_margin: input.targetMarginPercent,
    promotional_buffer: input.promotionalBufferPercent,
    assumptions: { items: input.assumptions },
    status: wasCalculated ? "STALE" : "READY_FOR_PRICING",
  });
  await recordAudit(service, {
    action: "PRICING_ASSUMPTIONS_UPDATED",
    entityType: "cost_quote",
    entityId: quote.id,
    actorId,
    summary: wasCalculated
      ? "Premissas alteradas; preço precisa ser recalculado"
      : "Premissas de pricing preenchidas",
    before: safeSnapshot(quote),
    after: safeSnapshot(quoteAfter),
  });
  if (wasCalculated)
    await recordAudit(service, {
      action: "PRICING_MARKED_STALE",
      entityType: "cost_quote",
      entityId: quote.id,
      actorId,
      summary: "Preço precisa ser recalculado",
    });
  await setPolicyReadiness(service, quote.supplier_offer.product_id, false);
  return quoteAfter;
}

export async function calculateCostQuote(
  container: MedusaContainer,
  quoteId: string,
  actorId: string | null,
) {
  if (activeCalculations.has(quoteId))
    throw new PricingError(
      "CALCULATION_IN_PROGRESS",
      "Outro cálculo já está em andamento",
    );
  activeCalculations.add(quoteId);
  const service = resolveService(container);
  try {
    const quote = await retrieveQuote(service, quoteId);
    const input = quoteToInputs(quote);
    await recordAudit(service, {
      action: "PRICING_CALCULATION_STARTED",
      entityType: "cost_quote",
      entityId: quote.id,
      actorId,
      summary: "Cálculo de pricing iniciado",
    });
    const taxStrategy = new ConfiguredImportTaxStrategy(
      input.customsStrategy,
      input.customsTaxEstimate,
      input.assumptions,
    );
    await taxStrategy.estimate({
      productValue: {
        amount: input.supplierUnitCost,
        currency: input.sourceCurrency,
      },
      freight: { amount: input.internationalShipping, currency: "BRL" },
      destinationCountry: "BR",
      calculatedAt: new Date().toISOString(),
    });
    const outputs = calculatePricing(input);
    const snapshots = await service.listPricingSnapshots({
      cost_quote_id: quote.id,
    });
    const version =
      snapshots.reduce((maximum, item) => Math.max(maximum, item.version), 0) +
      1;
    const calculatedAt = new Date();
    const snapshot = await service.createPricingSnapshots({
      cost_quote_id: quote.id,
      version,
      engine_version: PRICING_ENGINE_VERSION,
      inputs: input,
      outputs,
      assumptions: { items: input.assumptions },
      warnings: { items: outputs.warnings },
      fx_rate: input.fxRate,
      fx_source: input.fxSource,
      fx_timestamp: new Date(input.fxTimestamp),
      customs_strategy: input.customsStrategy,
      calculated_by: actorId,
      calculated_at: calculatedAt,
      approved_by: null,
      approved_at: null,
      approved_retail_price: null,
    });
    const updated = await service.updateCostQuotes({
      id: quote.id,
      status: "PRICED",
      landed_cost: outputs.landedCost,
      break_even_price: outputs.breakEvenPrice,
      suggested_retail_price: outputs.suggestedRetailPrice,
      gross_margin_percent: outputs.grossMarginPercent,
      contribution_margin: outputs.contributionMargin,
      warnings: { items: outputs.warnings },
      calculated_at: calculatedAt,
    });
    await setPolicyReadiness(service, quote.supplier_offer.product_id, false);
    await recordAudit(service, {
      action: "PRICING_CALCULATION_COMPLETED",
      entityType: "pricing_snapshot",
      entityId: snapshot.id,
      actorId,
      summary: `Pricing v${String(version)} calculado; publicação não alterada`,
      metadata: {
        cost_quote_id: quote.id,
        product_id: quote.supplier_offer.product_id,
      },
    });
    return { quote: updated, snapshot };
  } catch (error) {
    await recordAudit(service, {
      action: "PRICING_CALCULATION_FAILED",
      entityType: "cost_quote",
      entityId: quoteId,
      actorId,
      summary:
        error instanceof Error ? error.message : "Falha inesperada no cálculo",
    }).catch(() => undefined);
    if (error instanceof PricingError) throw error;
    throw new PricingError(
      "CALCULATION_FAILED",
      error instanceof Error ? error.message : "Falha inesperada no cálculo",
    );
  } finally {
    activeCalculations.delete(quoteId);
  }
}

export async function approveCostQuote(
  container: MedusaContainer,
  quoteId: string,
  actorId: string | null,
) {
  if (!actorId)
    throw new PricingError(
      "ACTOR_REQUIRED",
      "Administrador autenticado é obrigatório",
    );
  const service = resolveService(container);
  const quote = await retrieveQuote(service, quoteId);
  if (quote.status !== "PRICED" || !quote.suggested_retail_price)
    throw new PricingError(
      "QUOTE_NOT_PRICED",
      "Calcule um preço atual antes da aprovação",
    );
  const snapshots = await service.listPricingSnapshots({
    cost_quote_id: quote.id,
  });
  const snapshot = snapshots.sort((a, b) => b.version - a.version)[0];
  if (!snapshot)
    throw new PricingError(
      "SNAPSHOT_NOT_FOUND",
      "Snapshot de pricing não encontrado",
    );
  const approvedAt = new Date();
  const approvedSnapshot = await service.updatePricingSnapshots({
    id: snapshot.id,
    approved_by: actorId,
    approved_at: approvedAt,
    approved_retail_price: quote.suggested_retail_price,
  });
  const updated = await service.updateCostQuotes({
    id: quote.id,
    approved_by: actorId,
    approved_at: approvedAt,
    approved_retail_price: quote.suggested_retail_price,
    approved_snapshot_id: snapshot.id,
  });
  await setPolicyReadiness(service, quote.supplier_offer.product_id, true);
  await assertProductStillDraft(container, quote.supplier_offer.product_id);
  await recordAudit(service, {
    action: "PRICE_APPROVED",
    entityType: "pricing_snapshot",
    entityId: snapshot.id,
    actorId,
    summary: `Preço R$ ${quote.suggested_retail_price} aprovado; produto permanece DRAFT`,
    metadata: {
      cost_quote_id: quote.id,
      product_id: quote.supplier_offer.product_id,
    },
  });
  return { quote: updated, snapshot: approvedSnapshot };
}

export async function applySimpleRetailPrice(
  container: MedusaContainer,
  productId: string,
  priceBrl: number,
  actorId: string | null,
): Promise<void> {
  if (!actorId)
    throw new PricingError(
      "ACTOR_REQUIRED",
      "Administrador autenticado é obrigatório",
    );
  if (!Number.isFinite(priceBrl) || priceBrl <= 0)
    throw new PricingError(
      "COMMERCIAL_PRICE_INVALID",
      "Informe um preço válido",
    );
  const amount = priceBrl.toFixed(2);
  const products = container.resolve<{
    retrieveProduct(
      id: string,
      config?: object,
    ): Promise<{
      id: string;
      status: string;
      variants?: Array<{ id: string }>;
    }>;
  }>(Modules.PRODUCT);
  const product = await products.retrieveProduct(productId, {
    relations: ["variants"],
  });
  const variantIds = product.variants?.map((variant) => variant.id) ?? [];
  if (variantIds.length) {
    await updateProductVariantsWorkflow(container).run({
      input: {
        selector: { product_id: productId },
        update: {
          prices: [{ currency_code: "brl", amount: priceBrl }],
        },
      },
    });
  }
  const service = resolveService(container);
  const offers = await service.listSupplierOffers({ product_id: productId });
  const offer =
    offers.find((item) => item.is_primary) ??
    offers.find((item) => item.status === "ACTIVE") ??
    offers[0];
  if (!offer) return;
  if (!offer.is_primary || offer.status !== "ACTIVE")
    await service.updateSupplierOffers({
      id: offer.id,
      is_primary: true,
      status: "ACTIVE",
    });
  let [quote] = await service.listCostQuotes({ supplier_offer_id: offer.id });
  quote ??= await service.createCostQuotes({
    supplier_offer_id: offer.id,
    status: "INCOMPLETE",
    source_currency: offer.currency,
    supplier_unit_cost: offer.unit_cost,
    moq: offer.moq,
    assumptions: {
      items: ["Preço de venda definido pelo operador."],
    },
  });
  const snapshots = await service.listPricingSnapshots({
    cost_quote_id: quote.id,
  });
  const version =
    snapshots.reduce((maximum, item) => Math.max(maximum, item.version), 0) + 1;
  const now = new Date();
  const snapshot = await service.createPricingSnapshots({
    cost_quote_id: quote.id,
    version,
    engine_version: PRICING_ENGINE_VERSION,
    inputs: { simpleRetailPrice: amount, source: "operator_quick_price" },
    outputs: {
      suggestedRetailPrice: amount,
      approvedRetailPrice: amount,
    },
    assumptions: { items: ["Preço de venda definido pelo operador."] },
    warnings: { items: [] },
    fx_rate: quote.fx_rate ?? "1",
    fx_source: quote.fx_source ?? "Preço de venda do operador",
    fx_timestamp: now,
    customs_strategy: quote.customs_strategy ?? "MANUAL_QUOTE",
    calculated_by: actorId,
    calculated_at: now,
    approved_by: actorId,
    approved_at: now,
    approved_retail_price: amount,
  });
  await service.updateCostQuotes({
    id: quote.id,
    status: "PRICED",
    suggested_retail_price: amount,
    approved_retail_price: amount,
    approved_at: now,
    approved_by: actorId,
    approved_snapshot_id: snapshot.id,
  });
  await setPolicyReadiness(service, productId, true);
  await assertProductStillDraft(container, productId);
  await recordAudit(service, {
    action: "SIMPLE_RETAIL_PRICE_APPLIED",
    entityType: "cost_quote",
    entityId: quote.id,
    actorId,
    summary: `Preço de venda R$ ${amount} definido pelo operador`,
    metadata: { product_id: productId, snapshot_id: snapshot.id },
  });
}

export async function markOfferPricingStale(
  service: SupplierDomainModuleService,
  offerId: string,
  actorId: string | null,
): Promise<void> {
  const [quote] = await service.listCostQuotes({ supplier_offer_id: offerId });
  if (!quote || !["PRICED", "STALE"].includes(quote.status)) return;
  if (quote.status !== "STALE")
    await service.updateCostQuotes({ id: quote.id, status: "STALE" });
  await recordAudit(service, {
    action: "PRICING_MARKED_STALE",
    entityType: "cost_quote",
    entityId: quote.id,
    actorId,
    summary: "SupplierOffer alterada; preço precisa ser recalculado",
  });
}

type QuoteForPricing = {
  source_currency: string;
  supplier_unit_cost: string;
  moq: number;
  fx_rate: string | null;
  fx_source: string | null;
  fx_captured_at: Date | string | null;
  international_freight: string | null;
  international_shipping_allocation_method:
    "PER_UNIT" | "BY_QUANTITY" | "MANUAL" | null;
  shipping_allocation_quantity: number | null;
  customs_tax: string | null;
  customs_strategy:
    "CUSTOMER_AS_IMPORTER" | "MERCHANT_AS_IMPORTER" | "MANUAL_QUOTE" | null;
  branding_cost: string | null;
  branding_setup_cost: string | null;
  branding_setup_allocation: number | null;
  payment_fee: string | null;
  payment_gateway_percent: string | null;
  payment_gateway_provider: string | null;
  local_delivery: string | null;
  risk_reserve: string | null;
  returns_risk_reserve_percent: string | null;
  operational_reserve: string | null;
  operational_reserve_percent: string | null;
  target_margin: string | null;
  promotional_buffer: string | null;
  assumptions: unknown;
};

function quoteToInputs(quote: QuoteForPricing): PricingInputs {
  const requiredFields: Array<[string, unknown]> = [
    ["fx_rate", quote.fx_rate],
    ["fx_source", quote.fx_source],
    ["fx_captured_at", quote.fx_captured_at],
    ["international_freight", quote.international_freight],
    [
      "international_shipping_allocation_method",
      quote.international_shipping_allocation_method,
    ],
    ["shipping_allocation_quantity", quote.shipping_allocation_quantity],
    ["customs_tax", quote.customs_tax],
    ["customs_strategy", quote.customs_strategy],
    ["branding_cost", quote.branding_cost],
    ["branding_setup_cost", quote.branding_setup_cost],
    ["branding_setup_allocation", quote.branding_setup_allocation],
    ["payment_fee", quote.payment_fee],
    ["payment_gateway_percent", quote.payment_gateway_percent],
    ["payment_gateway_provider", quote.payment_gateway_provider],
    ["local_delivery", quote.local_delivery],
    ["risk_reserve", quote.risk_reserve],
    ["returns_risk_reserve_percent", quote.returns_risk_reserve_percent],
    ["operational_reserve", quote.operational_reserve],
    ["operational_reserve_percent", quote.operational_reserve_percent],
    ["target_margin", quote.target_margin],
    ["promotional_buffer", quote.promotional_buffer],
  ];
  const missing = requiredFields
    .filter(
      ([, value]) => value === null || value === undefined || value === "",
    )
    .map(([name]) => name);
  if (missing.length)
    throw new PricingError(
      "INCOMPLETE_QUOTE",
      `Premissas ausentes: ${missing.join(", ")}`,
    );
  return {
    sourceCurrency: quote.source_currency,
    supplierUnitCost: quote.supplier_unit_cost,
    moq: quote.moq,
    fxRate: required(quote.fx_rate, "fx_rate"),
    fxSource: required(quote.fx_source, "fx_source"),
    fxTimestamp: new Date(
      required(quote.fx_captured_at, "fx_captured_at"),
    ).toISOString(),
    internationalShipping: required(
      quote.international_freight,
      "international_freight",
    ),
    internationalShippingAllocationMethod: required(
      quote.international_shipping_allocation_method,
      "international_shipping_allocation_method",
    ),
    shippingAllocationQuantity: required(
      quote.shipping_allocation_quantity,
      "shipping_allocation_quantity",
    ),
    customsTaxEstimate: required(quote.customs_tax, "customs_tax"),
    customsStrategy: required(quote.customs_strategy, "customs_strategy"),
    brandingUnitCost: required(quote.branding_cost, "branding_cost"),
    brandingSetupCost: required(
      quote.branding_setup_cost,
      "branding_setup_cost",
    ),
    brandingSetupAllocationQuantity: required(
      quote.branding_setup_allocation,
      "branding_setup_allocation",
    ),
    paymentGatewayPercent: required(
      quote.payment_gateway_percent,
      "payment_gateway_percent",
    ),
    paymentGatewayFixed: required(quote.payment_fee, "payment_fee"),
    paymentGatewayProvider: required(
      quote.payment_gateway_provider,
      "payment_gateway_provider",
    ),
    localDeliveryCost: required(quote.local_delivery, "local_delivery"),
    returnsRiskReservePercent: required(
      quote.returns_risk_reserve_percent,
      "returns_risk_reserve_percent",
    ),
    returnsRiskReserveFixed: required(quote.risk_reserve, "risk_reserve"),
    operationalReservePercent: required(
      quote.operational_reserve_percent,
      "operational_reserve_percent",
    ),
    operationalReserveFixed: required(
      quote.operational_reserve,
      "operational_reserve",
    ),
    targetMarginPercent: required(quote.target_margin, "target_margin"),
    promotionalBufferPercent: required(
      quote.promotional_buffer,
      "promotional_buffer",
    ),
    assumptions: assumptionItems(quote.assumptions),
  };
}

async function retrieveQuote(
  service: SupplierDomainModuleService,
  quoteId: string,
) {
  const [quote] = await service.listCostQuotes(
    { id: quoteId },
    { relations: ["supplier_offer"] },
  );
  if (!quote)
    throw new PricingError("QUOTE_NOT_FOUND", "CostQuote não encontrado");
  return quote;
}

function resolveService(container: MedusaContainer) {
  return container.resolve<SupplierDomainModuleService>(SUPPLIER_DOMAIN_MODULE);
}

async function setPolicyReadiness(
  service: SupplierDomainModuleService,
  productId: string,
  approved: boolean,
): Promise<void> {
  const [policy] = await service.listProductPolicies({ product_id: productId });
  if (!policy) return;
  const readiness =
    policy.compliance_status === "BLOCKED"
      ? "BLOCKED"
      : !approved
        ? policy.compliance_status === "CLEAR"
          ? "PRICING_REQUIRED"
          : "COMPLIANCE_REQUIRED"
        : policy.compliance_status === "CLEAR"
          ? "READY_FOR_REVIEW"
          : "COMPLIANCE_REQUIRED";
  await service.updateProductPolicies({
    id: policy.id,
    commercial_readiness: readiness,
  });
}

async function assertProductStillDraft(
  container: MedusaContainer,
  productId: string,
) {
  const products = container.resolve<{
    retrieveProduct(
      id: string,
      config?: object,
    ): Promise<{ status: string; sales_channels?: unknown[] }>;
  }>(Modules.PRODUCT);
  const product = await products.retrieveProduct(productId, {
    relations: ["sales_channels"],
  });
  if (product.status !== "draft" || (product.sales_channels?.length ?? 0) !== 0)
    throw new PricingError(
      "PRODUCT_PUBLICATION_GUARD",
      "Produto importado deve permanecer DRAFT e sem canal de venda",
    );
}

function assumptionItems(value: unknown): string[] {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("items" in value)
  )
    return [];
  const items = (value as { items: unknown }).items;
  return Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string")
    : [];
}

function required<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined)
    throw new PricingError("INCOMPLETE_QUOTE", `Premissa ausente: ${field}`);
  return value;
}
