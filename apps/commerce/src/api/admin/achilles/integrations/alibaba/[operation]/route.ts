import { alibabaClientFromEnvironment } from "@achilles/alibaba-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { setRuntimeProviderHealth } from "../../../../../../integrations/runtime-health";
import { recordAudit } from "../../../audit";
import { actorId, type AdminRequest } from "../../../http";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  if (request.params.operation !== "test") {
    response
      .status(404)
      .json({ code: "NOT_FOUND", message: "Operação Alibaba não encontrada" });
    return;
  }
  const result = await alibabaClientFromEnvironment().testConnection(
    process.env.ALIBABA_HEALTHCHECK_PRODUCT_ID,
  );
  const testMode =
    process.env.APP_ENV === "test" && process.env.ALIBABA_TEST_MODE === "true";
  setRuntimeProviderHealth("ALIBABA", {
    connected: result.connected && !testMode,
    checkedAt: new Date().toISOString(),
    health: result.health,
    capabilities: result.capabilities,
    errorCode: result.error?.code ?? null,
    testMode,
  });
  try {
    const domain = request.scope.resolve<SupplierDomainModuleService>(
      SUPPLIER_DOMAIN_MODULE,
    );
    await recordAudit(domain, {
      action: "SUPPLIER_CONNECTION_TESTED",
      entityType: "supplier_platform",
      entityId: "ALIBABA",
      actorId: actorId(request as AdminRequest),
      summary: `Alibaba ${result.connected ? "CONNECTED" : result.health}`,
      metadata: {
        provider: "ALIBABA",
        operation: "connection_test",
        status: result.health,
        latency_ms: result.latencyMs,
        error_code: result.error?.code ?? null,
      },
    });
  } catch {
    // O health check continua útil mesmo se o audit sink estiver indisponível.
  }
  response.status(result.connected ? 200 : 503).json(result);
}
