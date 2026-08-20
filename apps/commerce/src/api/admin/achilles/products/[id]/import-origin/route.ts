import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { type AdminRequest } from "../../../http";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const productId = request.params.id;
  if (!productId) {
    response
      .status(400)
      .json({ code: "VALIDATION_ERROR", message: "ID do produto ausente" });
    return;
  }
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const offers = await service.listSupplierOffers(
    { product_id: productId },
    { relations: ["supplier", "cost_quotes"] },
  );
  const [policy] = await service.listProductPolicies({ product_id: productId });
  const importDraftId =
    offers.find((offer) => offer.import_draft_id)?.import_draft_id ??
    policy?.import_draft_id;
  const draft = importDraftId
    ? await service.retrieveImportDraft(importDraftId).catch(() => null)
    : null;
  response.json({ offers, policy: policy ?? null, draft });
}
