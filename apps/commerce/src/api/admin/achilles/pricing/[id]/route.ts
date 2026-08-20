import type { MedusaResponse } from "@medusajs/framework/http";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";
import { updatePricingAssumptions } from "../../../../../pricing/service";
import { actorId, notFound, parseOrReply, type AdminRequest } from "../../http";
import { pricingAssumptionsInput } from "../../schemas";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const service = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const [quote] = await service.listCostQuotes(
    { id: request.params.id },
    { relations: ["supplier_offer", "supplier_offer.supplier"] },
  );
  if (!quote) {
    notFound(response, "CostQuote");
    return;
  }
  const snapshots = await service.listPricingSnapshots(
    { cost_quote_id: quote.id },
    { order: { version: "DESC" } },
  );
  response.json({ quote, snapshots });
}

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(pricingAssumptionsInput, request.body, response);
  if (!input) return;
  try {
    const quote = await updatePricingAssumptions(
      request.scope,
      request.params.id ?? "",
      input,
      actorId(request),
    );
    response.json({ quote });
  } catch (error) {
    response.status(409).json({
      code: "PRICING_UPDATE_FAILED",
      message:
        error instanceof Error ? error.message : "Falha ao atualizar premissas",
    });
  }
}
