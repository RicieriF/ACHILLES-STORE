import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../../../audit";
import { actorId, parseOrReply, type AdminRequest } from "../../../http";
import { rejectImportInput } from "../../schemas";
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
  const input = parseOrReply(rejectImportInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const before = await service.retrieveImportDraft(id);
  try {
    assertDraftTransition(before.status, "REJECTED", {
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
    status: "REJECTED",
    failure_reason: input.reason,
  });
  await recordAudit(service, {
    action: "IMPORT_DRAFT_REJECTED",
    entityType: "import_draft",
    entityId: draft.id,
    actorId: actorId(request),
    summary: `Draft rejeitado: ${input.reason}`,
    before: safeSnapshot(before),
    after: safeSnapshot(draft),
  });
  response.json({ draft });
}
