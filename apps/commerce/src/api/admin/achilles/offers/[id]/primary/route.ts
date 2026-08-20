import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../audit";
import { actorId, notFound, type AdminRequest } from "../../../http";

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const target = (
    await service.listSupplierOffers({ id: request.params.id })
  )[0];
  if (!target) {
    notFound(response, "Oferta");
    return;
  }
  const current = (
    await service.listSupplierOffers({
      product_id: target.product_id,
      is_primary: true,
    })
  )[0];
  if (current?.id !== target.id) {
    if (current)
      await service.updateSupplierOffers({ id: current.id, is_primary: false });
    await service.updateSupplierOffers({ id: target.id, is_primary: true });
  }
  await recordAudit(service, {
    action: "PRIMARY_SUPPLIER_CHANGED",
    entityType: "product",
    entityId: target.product_id,
    actorId: actorId(request),
    summary: "Fornecedor principal alterado",
    metadata: {
      previous_offer_id: current?.id ?? null,
      current_offer_id: target.id,
    },
  });
  response.json({ offer: await service.retrieveSupplierOffer(target.id) });
}
