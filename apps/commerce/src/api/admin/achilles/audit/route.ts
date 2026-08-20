import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../modules/supplier-domain/service";
import { parseOrReply, type AdminRequest } from "../http";
import { paginationInput } from "../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const query = parseOrReply(paginationInput, request.query, response);
  if (!query) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const [events, count] = await service.listAndCountAuditEvents(
    {},
    { skip: query.offset, take: query.limit, order: { created_at: "DESC" } },
  );
  response.json({ events, count, limit: query.limit, offset: query.offset });
}
