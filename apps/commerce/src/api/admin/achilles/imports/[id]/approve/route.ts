import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../../../audit";
import { actorId, type AdminRequest } from "../../../http";
import { assertDraftTransition } from "../../transitions";
export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const id = request.params.id;
  if (!id) {
    response
      .status(400)
      .json({ code: "VALIDATION_ERROR", message: "ID do draft ausente" });
    return;
  }
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const before = await service.retrieveImportDraft(id);
  try {
    assertDraftTransition(before.status, "APPROVED", {
      complianceStatus: before.compliance_status,
      title: before.title_normalized,
    });
  } catch (error) {
    const known = error as Error & { code?: string };
    response.status(409).json({
      code: known.code ?? "INVALID_TRANSITION",
      message: known.message,
    });
    return;
  }
  const draft = await service.updateImportDrafts({
    id: before.id,
    status: "APPROVED",
  });
  await recordAudit(service, {
    action: "IMPORT_DRAFT_APPROVED",
    entityType: "import_draft",
    entityId: draft.id,
    actorId: actorId(request),
    summary:
      "Dados do draft aprovados para a próxima etapa; nenhum produto foi criado",
    before: safeSnapshot(before),
    after: safeSnapshot(draft),
  });
  response.json({ draft });
}
