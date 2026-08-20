import type { MedusaResponse } from "@medusajs/framework/http";
import { AlibabaCapabilityDisabledError } from "@achilles/alibaba-connector";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../audit";
import { actorId, type AdminRequest } from "../../../http";
import { processDraft } from "../../importer";
import { ImportRateLimitError } from "../../rate-limit";
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
  try {
    await recordAudit(service, {
      action: "IMPORT_REPROCESSED",
      entityType: "import_draft",
      entityId: id,
      actorId: actorId(request),
      summary: "Reprocessamento solicitado",
    });
    const draft = await processDraft(service, id, actorId(request));
    response.json({ draft });
  } catch (error) {
    if (error instanceof AlibabaCapabilityDisabledError) {
      response.status(409).json({
        code: "FEATURE_DISABLED",
        message:
          "Coleta automática desativada; edição manual continua disponível",
      });
      return;
    }
    if (error instanceof ImportRateLimitError) {
      response.setHeader("Retry-After", Math.ceil(error.retryAfterMs / 1000));
      response.status(429).json({
        code: "RATE_LIMITED",
        message: error.message,
        retry_after_ms: error.retryAfterMs,
      });
      return;
    }
    const known = error as Error & { code?: string };
    if (known.code === "INVALID_TRANSITION") {
      response.status(409).json({ code: known.code, message: known.message });
      return;
    }
    throw error;
  }
}
