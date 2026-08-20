import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { ShippingQuoteEngine } from "../../../../../shipping/engine";
import { sendShippingError } from "../../../../achilles/store/shipping/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";

const simulatorInput = z
  .object({
    variantId: z.string().trim().min(3).max(128),
    quantity: z.number().int().min(1).max(99),
    postalCode: z.string().trim().min(8).max(9),
  })
  .strict();

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const input = simulatorInput.parse(request.body);
    const result = await new ShippingQuoteEngine(request.scope).quoteProduct(
      input,
    );
    const service = request.scope.resolve<SupplierDomainModuleService>(
      SUPPLIER_DOMAIN_MODULE,
    );
    const offers = await service.listSupplierOffers(
      { id: result.candidates.map((candidate) => candidate.supplierOfferId) },
      { relations: ["supplier"] },
    );
    const supplierNameByOffer = new Map(
      offers.map((offer) => [offer.id, offer.supplier.name]),
    );
    response.json({
      quote: result.publicQuote,
      routing: result.routing,
      candidates: result.candidates.map((candidate) => ({
        ...candidate,
        supplierName:
          supplierNameByOffer.get(candidate.supplierOfferId) ??
          candidate.supplierOfferId,
      })),
    });
  } catch (error) {
    sendShippingError(response, error);
  }
}
