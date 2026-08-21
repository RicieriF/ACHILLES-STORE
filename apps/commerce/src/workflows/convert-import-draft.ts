import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import type SupplierDomainModuleService from "../modules/supplier-domain/service";
import { recordAudit } from "../api/admin/achilles/audit";

const pendingSupplierName = (provider: string) =>
  `[PENDENTE] Fornecedor ${provider} não identificado`;
const activeConversions = new Set<string>();
type DraftVariant = {
  supplierSku: string;
  title: string;
  attributes: Record<string, string>;
};
export class ImportConversionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImportConversionError";
  }
}
export type ConversionResult = {
  product_id: string;
  supplier_id: string;
  supplier_offer_id: string;
  cost_quote_id: string;
  product_policy_id: string;
  idempotent: boolean;
  commercial_readiness: string;
  compliance_status: string;
};

export function validateConvertibleDraft(draft: {
  status: string;
  compliance_status: string;
  title_normalized?: string | null;
  source_currency?: string | null;
  source_price_min?: string | null;
  converted_product_id?: string | null;
}): void {
  if (draft.converted_product_id) return;
  if (draft.status !== "APPROVED")
    throw new ImportConversionError(
      "DRAFT_NOT_APPROVED",
      "Somente drafts APPROVED podem ser convertidos",
    );
  if (draft.compliance_status === "BLOCKED")
    throw new ImportConversionError(
      "COMPLIANCE_BLOCKED",
      "Draft bloqueado por compliance não pode ser convertido",
    );
  if (
    !draft.title_normalized?.trim() ||
    !draft.source_currency ||
    !draft.source_price_min
  )
    throw new ImportConversionError(
      "INCOMPLETE_DATA",
      "Título, moeda e custo mínimo aprovados são obrigatórios",
    );
}

export function buildProductVariants(input: unknown): {
  options: Array<{ title: string; values: string[] }>;
  variants: Array<{
    title: string;
    manage_inventory: false;
    options: Record<string, string>;
    prices: never[];
  }>;
  source: DraftVariant[];
} {
  const items =
    isRecord(input) && Array.isArray(input.items)
      ? input.items.filter(isDraftVariant)
      : [];
  const source = items.length
    ? items
    : [{ supplierSku: "", title: "Padrão", attributes: {} }];
  const seen = new Map<string, number>();
  const values = source.map((variant) => {
    const base = variant.title.trim() || "Padrão";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${String(count)})`;
  });
  return {
    options: [{ title: "Variação de origem", values }],
    variants: source.map((variant, index) => ({
      title: values[index] ?? "Padrão",
      manage_inventory: false,
      options: { "Variação de origem": values[index] ?? "Padrão" },
      prices: [],
    })),
    source,
  };
}

export async function convertImportDraft(
  container: MedusaContainer,
  draftId: string,
  actorId: string | null,
): Promise<ConversionResult> {
  if (activeConversions.has(draftId))
    throw new ImportConversionError(
      "CONVERSION_IN_PROGRESS",
      "Outro administrador já está convertendo este draft",
    );
  activeConversions.add(draftId);
  const service = container.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  let productId: string | undefined;
  let supplierId: string | undefined;
  let createdSupplier = false;
  let offerId: string | undefined;
  let costQuoteId: string | undefined;
  let policyId: string | undefined;
  try {
    const draft = await service.retrieveImportDraft(draftId).catch(() => {
      throw new ImportConversionError(
        "DRAFT_NOT_FOUND",
        "Draft de importação não encontrado",
      );
    });
    validateConvertibleDraft(draft);
    if (draft.converted_product_id)
      return await existingResult(service, draft.converted_product_id);
    const approvedTitle = draft.title_normalized;
    const sourceCurrency = draft.source_currency;
    const sourceCost = draft.source_price_min;
    if (!approvedTitle || !sourceCurrency || !sourceCost)
      throw new ImportConversionError(
        "INCOMPLETE_DATA",
        "Dados mínimos aprovados ficaram indisponíveis",
      );
    const existingOffer = await service.listSupplierOffers({
      import_draft_id: draft.id,
    });
    if (existingOffer[0])
      return await existingResult(service, existingOffer[0].product_id);
    await service.updateImportDrafts({
      id: draft.id,
      conversion_status: "IN_PROGRESS",
      conversion_started_at: new Date(),
      conversion_failure_reason: null,
    });
    await recordAudit(service, {
      action: "IMPORT_CONVERSION_STARTED",
      entityType: "import_draft",
      entityId: draft.id,
      actorId,
      summary: "Conversão para produto interno iniciada",
    });

    const fulfillment = container.resolve<{
      listShippingProfiles(): Promise<Array<{ id: string; type: string }>>;
    }>(Modules.FULFILLMENT);
    const [shippingProfile] = await fulfillment.listShippingProfiles();
    if (!shippingProfile)
      throw new ImportConversionError(
        "PRODUCT_CREATION_FAILED",
        "Perfil de entrega obrigatório não encontrado",
      );
    const productModule = container.resolve<{
      listProductCategories(
        filters: Record<string, unknown>,
      ): Promise<Array<{ id: string; name: string }>>;
    }>(Modules.PRODUCT);
    const categories = draft.category_suggested
      ? await productModule.listProductCategories({
          name: draft.category_suggested,
        })
      : [];
    const normalizedVariants = buildProductVariants(draft.variants);
    const { result: products } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: approvedTitle,
            description: draft.description_normalized ?? null,
            status: ProductStatus.DRAFT,
            shipping_profile_id: shippingProfile.id,
            sales_channels: [],
            category_ids: categories[0] ? [categories[0].id] : [],
            images: mediaItems(draft.media).map((url) => ({ url })),
            metadata: {
              achilles_import_draft_id: draft.id,
              commercial_readiness: readiness(draft.compliance_status),
              approved_specifications: JSON.stringify(draft.specifications),
            },
            options: normalizedVariants.options,
            variants: normalizedVariants.variants,
          },
        ],
      },
    });
    const product = products[0];
    if (!product)
      throw new ImportConversionError(
        "PRODUCT_CREATION_FAILED",
        "Medusa não retornou o produto criado",
      );
    productId = product.id;
    await recordAudit(service, {
      action: "PRODUCT_CREATED_FROM_IMPORT",
      entityType: "product",
      entityId: product.id,
      actorId,
      summary: `Produto DRAFT criado a partir de ${draft.id}`,
      metadata: { import_draft_id: draft.id },
    });

    let [supplier] = await service.listSuppliers({
      provider: draft.provider,
      name: pendingSupplierName(draft.provider),
    });
    if (!supplier) {
      supplier = await service.createSuppliers({
        name: pendingSupplierName(draft.provider),
        provider: draft.provider,
        status: "INACTIVE",
        country_code: "CN",
        notes: "Identidade empresarial pendente de confirmação humana",
        metadata: { resolution: "MANUAL_PENDING" },
      });
      createdSupplier = true;
    }
    supplierId = supplier.id;
    await recordAudit(service, {
      action: createdSupplier
        ? "SUPPLIER_CREATED_FOR_IMPORT"
        : "SUPPLIER_REUSED_FOR_IMPORT",
      entityType: "supplier",
      entityId: supplier.id,
      actorId,
      summary: createdSupplier
        ? "Fornecedor pendente criado"
        : "Fornecedor pendente reutilizado",
      metadata: { import_draft_id: draft.id },
    });

    const offer = await service.createSupplierOffers({
      supplier_id: supplier.id,
      product_id: product.id,
      supplier_product_id: draft.supplier_product_id ?? `manual:${draft.id}`,
      source_url: draft.source_url,
      canonical_source_url: draft.canonical_source_url,
      import_draft_id: draft.id,
      currency: sourceCurrency,
      unit_cost: sourceCost,
      unit_cost_max: draft.source_price_max ?? null,
      moq: draft.moq ?? 1,
      availability: "UNKNOWN",
      status: "INACTIVE",
      fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
      private_label_supported: false,
      is_primary: false,
      freight_metadata: null,
      last_sync_at: draft.last_fetch_at ?? null,
      sync_status: draft.last_fetch_at ? "SYNCED" : "NEVER_SYNCED",
      raw_source_reference: draft.id,
      notes:
        "Criada por conversão de ImportDraft; condições comerciais pendentes",
    });
    offerId = offer.id;
    await recordAudit(service, {
      action: "SUPPLIER_OFFER_CREATED_FROM_IMPORT",
      entityType: "supplier_offer",
      entityId: offer.id,
      actorId,
      summary: "SupplierOffer inativa criada a partir do draft",
      metadata: { import_draft_id: draft.id, product_id: product.id },
    });

    const productVariants = product.variants;
    for (let index = 0; index < normalizedVariants.source.length; index += 1) {
      const sourceVariant = normalizedVariants.source[index];
      const storeVariant = productVariants[index];
      if (sourceVariant?.supplierSku && storeVariant)
        await service.createSupplierVariantMaps({
          supplier_offer_id: offer.id,
          store_variant_id: storeVariant.id,
          supplier_sku: sourceVariant.supplierSku,
          supplier_variant_id: null,
          attributes: sourceVariant.attributes,
        });
    }
    const costQuote = await service.createCostQuotes({
      supplier_offer_id: offer.id,
      status: "INCOMPLETE",
      source_currency: sourceCurrency,
      supplier_unit_cost: sourceCost,
      supplier_unit_cost_max: draft.source_price_max ?? null,
      moq: draft.moq ?? 1,
      fx_rate: null,
      fx_source: null,
      fx_captured_at: null,
      international_freight: null,
      customs_tax: null,
      branding_cost: null,
      payment_fee: null,
      local_delivery: null,
      risk_reserve: null,
      target_margin: null,
      assumptions: {
        items: [
          "Preço de origem não é preço de venda",
          "Câmbio pendente",
          "Frete internacional pendente",
          "Tributação pendente",
          "Margem pendente",
        ],
      },
    });
    costQuoteId = costQuote.id;
    await recordAudit(service, {
      action: "COST_QUOTE_CREATED",
      entityType: "cost_quote",
      entityId: costQuote.id,
      actorId,
      summary: "CostQuote preliminar INCOMPLETE criado",
      metadata: { product_id: product.id, supplier_offer_id: offer.id },
    });
    const policy = await service.createProductPolicies({
      product_id: product.id,
      fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
      compliance_status: draft.compliance_status,
      sensitivity:
        draft.compliance_status === "REVIEW_REQUIRED"
          ? "EDGED_TOOL"
          : "ORDINARY",
      compliance_notes: `Triagem propagada do ImportDraft ${draft.id}; revisão final pendente`,
      reviewed_by: null,
      reviewed_at: null,
      commercial_readiness: readiness(draft.compliance_status),
      import_draft_id: draft.id,
    });
    policyId = policy.id;
    await recordAudit(service, {
      action: "COMPLIANCE_APPLIED_FROM_IMPORT",
      entityType: "product_policy",
      entityId: policy.id,
      actorId,
      summary: `Compliance ${draft.compliance_status} aplicado`,
      metadata: { import_draft_id: draft.id, product_id: product.id },
    });
    await service.updateImportDrafts({
      id: draft.id,
      converted_product_id: product.id,
      conversion_status: "COMPLETED",
      conversion_completed_at: new Date(),
      conversion_failure_reason: null,
    });
    await recordAudit(service, {
      action: "IMPORT_CONVERSION_COMPLETED",
      entityType: "import_draft",
      entityId: draft.id,
      actorId,
      summary:
        "Conversão concluída; produto permanece DRAFT e sem preço de venda",
      metadata: {
        product_id: product.id,
        supplier_id: supplier.id,
        supplier_offer_id: offer.id,
        cost_quote_id: costQuote.id,
      },
    });
    return {
      product_id: product.id,
      supplier_id: supplier.id,
      supplier_offer_id: offer.id,
      cost_quote_id: costQuote.id,
      product_policy_id: policy.id,
      idempotent: false,
      commercial_readiness: policy.commercial_readiness,
      compliance_status: policy.compliance_status,
    };
  } catch (error) {
    await compensate(container, service, {
      productId,
      supplierId,
      createdSupplier,
      offerId,
      costQuoteId,
      policyId,
    });
    const message =
      error instanceof Error ? error.message : "Falha inesperada na conversão";
    try {
      await service.updateImportDrafts({
        id: draftId,
        conversion_status: "FAILED",
        conversion_failure_reason: message,
      });
      await recordAudit(service, {
        action: "IMPORT_CONVERSION_FAILED",
        entityType: "import_draft",
        entityId: draftId,
        actorId,
        summary: `Conversão falhou e foi revertida: ${message}`,
      });
    } catch {
      /* preserve original conversion failure */
    }
    if (error instanceof ImportConversionError) throw error;
    if (isUniqueConflict(error))
      throw new ImportConversionError(
        "CONVERSION_CONFLICT",
        "Conversão concorrente detectada; nenhum registro duplicado foi mantido",
      );
    throw new ImportConversionError(
      "TRANSACTION_ROLLED_BACK",
      `Conversão revertida: ${message}`,
    );
  } finally {
    activeConversions.delete(draftId);
  }
}

async function compensate(
  container: MedusaContainer,
  service: SupplierDomainModuleService,
  state: {
    productId?: string | undefined;
    supplierId?: string | undefined;
    createdSupplier: boolean;
    offerId?: string | undefined;
    costQuoteId?: string | undefined;
    policyId?: string | undefined;
  },
): Promise<void> {
  if (state.policyId)
    await service.deleteProductPolicies(state.policyId).catch(() => undefined);
  if (state.costQuoteId)
    await service.deleteCostQuotes(state.costQuoteId).catch(() => undefined);
  if (state.offerId) {
    const maps = await service
      .listSupplierVariantMaps({ supplier_offer_id: state.offerId })
      .catch(() => []);
    if (maps.length)
      await service
        .deleteSupplierVariantMaps(maps.map((item) => item.id))
        .catch(() => undefined);
    await service.deleteSupplierOffers(state.offerId).catch(() => undefined);
  }
  if (state.productId)
    await deleteProductsWorkflow(container)
      .run({ input: { ids: [state.productId] } })
      .catch(() => undefined);
  if (state.createdSupplier && state.supplierId)
    await service.deleteSuppliers(state.supplierId).catch(() => undefined);
}
async function existingResult(
  service: SupplierDomainModuleService,
  productId: string,
): Promise<ConversionResult> {
  const [offer] = await service.listSupplierOffers({ product_id: productId });
  if (!offer)
    throw new ImportConversionError(
      "INCONSISTENT_CONVERSION",
      "Conversão existente não possui SupplierOffer",
    );
  const [cost] = await service.listCostQuotes({ supplier_offer_id: offer.id });
  const [policy] = await service.listProductPolicies({ product_id: productId });
  if (!cost || !policy)
    throw new ImportConversionError(
      "INCONSISTENT_CONVERSION",
      "Conversão existente está incompleta",
    );
  return {
    product_id: productId,
    supplier_id: offer.supplier_id,
    supplier_offer_id: offer.id,
    cost_quote_id: cost.id,
    product_policy_id: policy.id,
    idempotent: true,
    commercial_readiness: policy.commercial_readiness,
    compliance_status: policy.compliance_status,
  };
}
const readiness = (compliance: string) =>
  compliance === "REVIEW_REQUIRED"
    ? ("COMPLIANCE_REQUIRED" as const)
    : ("PRICING_REQUIRED" as const);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isDraftVariant = (value: unknown): value is DraftVariant =>
  isRecord(value) &&
  typeof value.supplierSku === "string" &&
  typeof value.title === "string" &&
  isRecord(value.attributes);
const mediaItems = (value: unknown): string[] =>
  isRecord(value) && Array.isArray(value.items)
    ? value.items.filter(
        (item): item is string =>
          typeof item === "string" && item.startsWith("https://"),
      )
    : [];
const isUniqueConflict = (error: unknown): boolean =>
  error instanceof Error && /unique|duplicate/i.test(error.message);
