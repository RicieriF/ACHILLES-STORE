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
import { brandingProfileInput, paginationInput } from "../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const query = parseOrReply(paginationInput, request.query, response);
  if (!query) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const filters = query.supplier_id ? { supplier_id: query.supplier_id } : {};
  const [profiles, count] = await service.listAndCountBrandingProfiles(
    filters,
    {
      skip: query.offset,
      take: query.limit,
      order: { created_at: "DESC" },
      relations: ["supplier"],
    },
  );
  response.json({ profiles, count, limit: query.limit, offset: query.offset });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(brandingProfileInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const profile = await service.createBrandingProfiles(stripUndefined(input));
  await recordAudit(service, {
    action: "BRANDING_PROFILE_CREATED",
    entityType: "branding_profile",
    entityId: profile.id,
    actorId: actorId(request),
    summary: `Perfil ${profile.name} criado`,
    after: safeSnapshot(profile),
  });
  response.status(201).json({ profile });
}
