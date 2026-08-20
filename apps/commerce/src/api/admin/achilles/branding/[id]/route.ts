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
import { brandingProfileInput } from "../../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const profile = (
    await service.listBrandingProfiles(
      { id: request.params.id },
      { relations: ["supplier", "offers"] },
    )
  )[0];
  if (!profile) {
    notFound(response, "Perfil de marca");
    return;
  }
  response.json({ profile });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(
    brandingProfileInput.partial(),
    request.body,
    response,
  );
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const existing = (
    await service.listBrandingProfiles({ id: request.params.id })
  )[0];
  if (!existing) {
    notFound(response, "Perfil de marca");
    return;
  }
  const profile = await service.updateBrandingProfiles({
    id: existing.id,
    ...stripUndefined(input),
  });
  await recordAudit(service, {
    action: "BRANDING_PROFILE_UPDATED",
    entityType: "branding_profile",
    entityId: profile.id,
    actorId: actorId(request),
    summary: `Perfil ${profile.name} atualizado`,
    before: safeSnapshot(existing),
    after: safeSnapshot(profile),
  });
  response.json({ profile });
}
