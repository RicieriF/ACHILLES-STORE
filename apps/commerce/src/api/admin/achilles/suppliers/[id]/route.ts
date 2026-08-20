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
import { supplierInput } from "../../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const supplier = await service.listSuppliers(
    { id: request.params.id },
    { relations: ["offers", "branding_profiles"] },
  );
  if (!supplier[0]) {
    notFound(response, "Fornecedor");
    return;
  }
  response.json({ supplier: supplier[0] });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(supplierInput.partial(), request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const existing = (await service.listSuppliers({ id: request.params.id }))[0];
  if (!existing) {
    notFound(response, "Fornecedor");
    return;
  }
  const supplier = await service.updateSuppliers({
    id: existing.id,
    ...stripUndefined(input),
  });
  await recordAudit(service, {
    action: "SUPPLIER_UPDATED",
    entityType: "supplier",
    entityId: supplier.id,
    actorId: actorId(request),
    summary: `Fornecedor ${supplier.name} atualizado`,
    before: safeSnapshot(existing),
    after: safeSnapshot(supplier),
  });
  response.json({ supplier });
}
