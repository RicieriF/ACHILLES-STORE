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
import { productPolicyInput } from "../../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const policy = (
    await service.listProductPolicies({ id: request.params.id })
  )[0];
  if (!policy) {
    notFound(response, "Política");
    return;
  }
  const history = await service.listAuditEvents(
    { entity_type: "product_policy", entity_id: policy.id },
    { order: { created_at: "DESC" }, take: 25 },
  );
  response.json({ policy, history });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(productPolicyInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const existing = (
    await service.listProductPolicies({ id: request.params.id })
  )[0];
  if (!existing) {
    notFound(response, "Política");
    return;
  }
  const reviewer = actorId(request);
  const policy = await service.updateProductPolicies({
    id: existing.id,
    ...stripUndefined(input),
    reviewed_by: reviewer,
    reviewed_at: new Date(),
  });
  await recordAudit(service, {
    action: "COMPLIANCE_CHANGED",
    entityType: "product_policy",
    entityId: policy.id,
    actorId: reviewer,
    summary: `Compliance alterado para ${policy.compliance_status}`,
    before: safeSnapshot(existing),
    after: safeSnapshot(policy),
  });
  response.json({ policy });
}
