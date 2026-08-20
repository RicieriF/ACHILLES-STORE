import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { type AdminRequest } from "../../../http";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const snapshots = await service.listPricingSnapshots(
    { cost_quote_id: request.params.id },
    { order: { version: "DESC" } },
  );
  response.json({ snapshots, count: snapshots.length });
}
