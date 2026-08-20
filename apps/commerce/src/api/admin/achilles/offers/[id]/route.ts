import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../../audit";
import {
  actorId,
  conflict,
  notFound,
  parseOrReply,
  stripUndefined,
  type AdminRequest,
} from "../../http";
import { supplierOfferInput } from "../../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const offer = (
    await service.listSupplierOffers(
      { id: request.params.id },
      { relations: ["supplier", "branding_profile", "variant_maps"] },
    )
  )[0];
  if (!offer) {
    notFound(response, "Oferta");
    return;
  }
  response.json({ offer });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(
    supplierOfferInput.partial(),
    request.body,
    response,
  );
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const existing = (
    await service.listSupplierOffers({ id: request.params.id })
  )[0];
  if (!existing) {
    notFound(response, "Oferta");
    return;
  }
  if (input.is_primary && !existing.is_primary) {
    const primary = await service.listSupplierOffers({
      product_id: input.product_id ?? existing.product_id,
      is_primary: true,
    });
    if (primary.length) {
      conflict(response, "Use a ação de trocar fornecedor principal");
      return;
    }
  }
  const offer = await service.updateSupplierOffers({
    id: existing.id,
    ...stripUndefined(input),
  });
  await recordAudit(service, {
    action: "SUPPLIER_OFFER_UPDATED",
    entityType: "supplier_offer",
    entityId: offer.id,
    actorId: actorId(request),
    summary: `Oferta ${offer.supplier_product_id} atualizada`,
    before: safeSnapshot(existing),
    after: safeSnapshot(offer),
  });
  response.json({ offer });
}

export async function DELETE(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const existing = (
    await service.listSupplierOffers({ id: request.params.id })
  )[0];
  if (!existing) {
    notFound(response, "Oferta");
    return;
  }
  await service.deleteSupplierOffers(existing.id);
  await recordAudit(service, {
    action: "SUPPLIER_OFFER_UNLINKED",
    entityType: "supplier_offer",
    entityId: existing.id,
    actorId: actorId(request),
    summary: "Vínculo de fornecimento removido",
    before: safeSnapshot(existing),
  });
  response.status(200).json({ id: existing.id, deleted: true });
}
