import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../audit";
import {
  actorId,
  parseOrReply,
  stripUndefined,
  type AdminRequest,
} from "../http";
import { paginationInput, supplierInput } from "../schemas";

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
  if (query.q) filters.name = { $ilike: `%${query.q}%` };
  if (query.status) filters.status = query.status;
  const [suppliers, count] = await service.listAndCountSuppliers(filters, {
    skip: query.offset,
    take: query.limit,
    order: { created_at: "DESC" },
  });
  response.json({ suppliers, count, limit: query.limit, offset: query.offset });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(supplierInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const supplier = await service.createSuppliers(stripUndefined(input));
  await recordAudit(service, {
    action: "SUPPLIER_CREATED",
    entityType: "supplier",
    entityId: supplier.id,
    actorId: actorId(request),
    summary: `Fornecedor ${supplier.name} criado`,
    after: safeSnapshot(supplier),
  });
  response.status(201).json({ supplier });
}
