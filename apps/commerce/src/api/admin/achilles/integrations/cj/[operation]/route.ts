import { cjClientFromEnvironment } from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../audit";
import { actorId, type AdminRequest } from "../../../http";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  if (request.params.operation !== "test") {
    response
      .status(404)
      .json({ code: "NOT_FOUND", message: "Operação CJ não encontrada" });
    return;
  }
  const result = await cjClientFromEnvironment().testConnection();
  try {
    const domain = request.scope.resolve<SupplierDomainModuleService>(
      SUPPLIER_DOMAIN_MODULE,
    );
    await recordAudit(domain, {
      action: "SUPPLIER_CONNECTION_TESTED",
      entityType: "supplier_platform",
      entityId: "CJ",
      actorId: actorId(request as AdminRequest),
      summary: `CJ ${result.connected ? "CONNECTED" : result.health}`,
      metadata: {
        provider: "CJ",
        status: result.health,
        latency_ms: result.latencyMs,
        error_code: result.error?.code ?? null,
      },
    });
  } catch {
    // A indisponibilidade do audit sink não deve mascarar o health check externo.
  }
  response.json(result);
}
