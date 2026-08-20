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
  const filters: Record<string, unknown> = {};
  if (query.status) filters.compliance_status = query.status;
  if (query.product_id) filters.product_id = query.product_id;
  const [policies, count] = await service.listAndCountProductPolicies(filters, {
    skip: query.offset,
    take: query.limit,
    order: { updated_at: "DESC" },
  });
  response.json({ policies, count, limit: query.limit, offset: query.offset });
}
