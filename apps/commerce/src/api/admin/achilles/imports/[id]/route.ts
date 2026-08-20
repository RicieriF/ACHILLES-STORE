import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../../audit";
import {
  actorId,
  notFound,
  parseOrReply,
  stripUndefined,
  type AdminRequest,
} from "../../http";
import { updateImportInput } from "../schemas";
export async function GET(
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
  try {
    const draft = await service.retrieveImportDraft(id);
    const attempts = await service.listImportAttempts(
      { import_draft_id: id },
      { order: { created_at: "DESC" } },
    );
    response.json({ draft, attempts });
  } catch {
    notFound(response, "Draft");
  }
}
export async function PATCH(
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
  const input = parseOrReply(updateImportInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  try {
    const before = await service.retrieveImportDraft(id);
    if (["APPROVED", "REJECTED"].includes(before.status)) {
      response.status(409).json({
        code: "INVALID_TRANSITION",
        message: "Draft finalizado não pode ser editado",
      });
      return;
    }
    const { media, variants, ...scalarInput } = stripUndefined(input);
    const draft = await service.updateImportDrafts({
      id,
      ...scalarInput,
      ...(media ? { media: { items: media } } : {}),
      ...(variants ? { variants: { items: variants } } : {}),
      status: "NEEDS_REVIEW",
    });
    await recordAudit(service, {
      action: "IMPORT_DRAFT_EDITED",
      entityType: "import_draft",
      entityId: draft.id,
      actorId: actorId(request),
      summary: "Draft editado manualmente",
      before: safeSnapshot(before),
      after: safeSnapshot(draft),
    });
    response.json({ draft });
  } catch {
    notFound(response, "Draft");
  }
}
