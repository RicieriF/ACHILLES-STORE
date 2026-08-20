import {
  AlibabaCapabilityDisabledError,
  AlibabaCollectionError,
  AlibabaConnector,
  AlibabaUrlError,
  NORMALIZER_VERSION,
} from "@achilles/alibaba-connector";
import { parseFeatureFlags } from "@achilles/config";
import type { SupplierProductSource } from "@achilles/domain";
import type SupplierDomainModuleService from "../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../audit";
import { withImportLock } from "./rate-limit";

const ACTIVE = ["FETCHING", "PARSED", "NEEDS_REVIEW"];
export async function createOrReuseDraft(
  service: SupplierDomainModuleService,
  sourceUrl: string,
  actor: string | null,
) {
  const connector = new AlibabaConnector(parseFeatureFlags(process.env));
  const reference = await connector.resolveProductUrl(sourceUrl);
  const canonical = reference.sourceUrl;
  const existing = await service.listImportDrafts({
    canonical_source_url: canonical,
    status: ACTIVE,
  });
  if (existing[0]) return { draft: existing[0], reused: true };
  if (reference.supplierProductId) {
    const sameProduct = await service.listImportDrafts({
      provider: "ALIBABA",
      supplier_product_id: reference.supplierProductId,
      status: ACTIVE,
    });
    if (sameProduct[0]) return { draft: sameProduct[0], reused: true };
  }
  const draft = await service.createImportDrafts({
    provider: "ALIBABA",
    source_url: sourceUrl,
    canonical_source_url: canonical,
    supplier_product_id: reference.supplierProductId || null,
    status: "NEEDS_REVIEW",
    media: { items: [] },
    specifications: {},
    variants: { items: [] },
    alerts: {
      items: connector.capabilities.productImport
        ? []
        : [
            "Coleta automática desativada pela feature flag; complete manualmente.",
          ],
    },
    compliance_status: "CLEAR",
    created_by: actor,
  });
  await recordAudit(service, {
    action: "IMPORT_DRAFT_CREATED",
    entityType: "import_draft",
    entityId: draft.id,
    actorId: actor,
    summary: "Draft de importação criado",
    after: safeSnapshot(draft),
  });
  if (!connector.capabilities.productImport) {
    await service.createImportAttempts({
      import_draft_id: draft.id,
      source_url: sourceUrl,
      canonical_url: canonical,
      provider: "ALIBABA",
      result: "MANUAL_REVIEW",
      method: "MANUAL",
      essential_data: {
        supplier_product_id: reference.supplierProductId || null,
      },
      error_code: "FEATURE_DISABLED",
      error_message: "ALIBABA_PRODUCT_IMPORT=false",
      parser_version: "none",
      normalizer_version: NORMALIZER_VERSION,
    });
    return { draft, reused: false };
  }
  return { draft: await processDraft(service, draft.id, actor), reused: false };
}

export async function processDraft(
  service: SupplierDomainModuleService,
  id: string,
  actor: string | null,
) {
  const draft = await service.retrieveImportDraft(id);
  if (["APPROVED", "REJECTED"].includes(draft.status))
    throw Object.assign(
      new Error("Draft finalizado não pode ser reprocessado"),
      { code: "INVALID_TRANSITION" },
    );
  const connector = new AlibabaConnector(parseFeatureFlags(process.env));
  if (!connector.capabilities.productImport)
    throw new AlibabaCapabilityDisabledError("productImport");
  return withImportLock(draft.canonical_source_url, async () => {
    await service.updateImportDrafts({
      id,
      status: "FETCHING",
      failure_reason: null,
    });
    await recordAudit(service, {
      action: "IMPORT_STARTED",
      entityType: "import_draft",
      entityId: id,
      actorId: actor,
      summary: "Coleta de importação iniciada",
    });
    try {
      const reference = await connector.resolveProductUrl(draft.source_url);
      const source = await connector.collectProduct(reference);
      const normalized = connector.normalizeProduct(source);
      const status =
        normalized.compliance === "BLOCKED" || normalized.alerts.length
          ? "NEEDS_REVIEW"
          : "PARSED";
      const updated = await service.updateImportDrafts({
        id,
        canonical_source_url: reference.sourceUrl,
        supplier_product_id: reference.supplierProductId || null,
        status,
        title_raw: source.title ?? null,
        title_normalized: normalized.title ?? null,
        description_raw: source.description ?? null,
        description_normalized: normalized.description ?? null,
        source_currency: normalized.currency ?? null,
        source_price_min: normalized.priceMin ?? null,
        source_price_max: normalized.priceMax ?? null,
        moq: normalized.moq ?? null,
        category_raw: source.category ?? null,
        category_suggested: normalized.categorySuggested ?? null,
        media: { items: [...source.media] },
        specifications: normalized.specifications,
        variants: { items: [...normalized.variants] },
        supplier_snapshot: snapshot(source),
        raw_provider_metadata: source.metadata,
        compliance_status: normalized.compliance,
        alerts: { items: [...normalized.alerts] },
        failure_reason: null,
        last_fetch_at: new Date(),
      });
      await service.createImportAttempts({
        import_draft_id: id,
        source_url: draft.source_url,
        canonical_url: reference.sourceUrl,
        provider: "ALIBABA",
        result: status,
        method: source.method,
        essential_data: snapshot(source),
        error_code: null,
        error_message: null,
        parser_version: "json-ld/1.0.0",
        normalizer_version: normalized.normalizerVersion,
      });
      await recordAudit(service, {
        action: "IMPORT_COMPLETED",
        entityType: "import_draft",
        entityId: id,
        actorId: actor,
        summary: "Coleta concluída; revisão humana pendente",
        after: safeSnapshot(updated),
      });
      return updated;
    } catch (error) {
      const classified = classify(error);
      const updated = await service.updateImportDrafts({
        id,
        status: "FAILED",
        failure_reason: classified.message,
        last_fetch_at: new Date(),
      });
      await service.createImportAttempts({
        import_draft_id: id,
        source_url: draft.source_url,
        canonical_url: draft.canonical_source_url,
        provider: "ALIBABA",
        result: "FAILED",
        method: "PUBLIC_PAGE",
        essential_data: null,
        error_code: classified.code,
        error_message: classified.message,
        parser_version: "json-ld/1.0.0",
        normalizer_version: NORMALIZER_VERSION,
      });
      await recordAudit(service, {
        action: "IMPORT_FAILED",
        entityType: "import_draft",
        entityId: id,
        actorId: actor,
        summary: `Importação falhou: ${classified.message}`,
      });
      return updated;
    }
  });
}
function snapshot(source: SupplierProductSource) {
  return {
    obtained_at: source.obtainedAt,
    method: source.method,
    supplier_product_id: source.reference.supplierProductId,
    title: source.title ?? null,
    currency: source.currency ?? null,
    price_min: source.priceMin ?? null,
    price_max: source.priceMax ?? null,
    moq: source.moq ?? null,
    media_count: source.media.length,
    specification_keys: Object.keys(source.specifications),
    variant_count: source.variants.length,
  };
}
function classify(error: unknown): { code: string; message: string } {
  if (error instanceof AlibabaUrlError)
    return { code: error.code, message: error.message };
  if (error instanceof AlibabaCollectionError)
    return { code: error.code, message: error.message };
  if (error instanceof Error && error.name === "AbortError")
    return {
      code: "TIMEOUT",
      message: "Tempo limite da coleta externa excedido",
    };
  if (error instanceof Error)
    return {
      code: "EXTERNAL_UNAVAILABLE",
      message: error.message || "Acesso externo indisponível",
    };
  return {
    code: "EXTERNAL_UNAVAILABLE",
    message: "Acesso externo indisponível",
  };
}
