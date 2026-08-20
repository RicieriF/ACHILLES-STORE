import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../audit";
import {
  actorId,
  conflict,
  parseOrReply,
  stripUndefined,
  type AdminRequest,
} from "../http";
import { paginationInput, supplierOfferInput } from "../schemas";

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
  if (query.status) filters.status = query.status;
  if (query.product_id) filters.product_id = query.product_id;
  if (query.supplier_id) filters.supplier_id = query.supplier_id;
  const [offers, count] = await service.listAndCountSupplierOffers(filters, {
    skip: query.offset,
    take: query.limit,
    order: { is_primary: "DESC", created_at: "DESC" },
    relations: ["supplier", "branding_profile"],
  });
  response.json({ offers, count, limit: query.limit, offset: query.offset });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(supplierOfferInput, request.body, response);
  if (!input) return;
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  if (input.is_primary) {
    const primary = await service.listSupplierOffers({
      product_id: input.product_id,
      is_primary: true,
    });
    if (primary.length) {
      conflict(response, "O produto já possui fornecedor principal");
      return;
    }
  }
  const offer = await service.createSupplierOffers(stripUndefined(input));
  await recordAudit(service, {
    action: "SUPPLIER_OFFER_CREATED",
    entityType: "supplier_offer",
    entityId: offer.id,
    actorId: actorId(request),
    summary: `Oferta ${offer.supplier_product_id} criada`,
    after: safeSnapshot(offer),
  });
  response.status(201).json({ offer });
}
