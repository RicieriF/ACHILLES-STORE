import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const decisions = await service.listSupplierRoutingDecisions(
    {},
    { take: 50, order: { decided_at: "DESC" } },
  );
  response.json({ decisions });
}
