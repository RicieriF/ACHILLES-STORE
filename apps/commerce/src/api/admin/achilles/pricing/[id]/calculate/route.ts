import type { MedusaResponse } from "@medusajs/framework/http";
import {
  calculateCostQuote,
  PricingError,
} from "../../../../../../pricing/service";
import { actorId, type AdminRequest } from "../../../http";

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json({
      pricing: await calculateCostQuote(
        request.scope,
        request.params.id ?? "",
        actorId(request),
      ),
    });
  } catch (error) {
    response
      .status(
        error instanceof PricingError && error.code === "QUOTE_NOT_FOUND"
          ? 404
          : 409,
      )
      .json({
        code: error instanceof PricingError ? error.code : "CALCULATION_FAILED",
        message:
          error instanceof Error ? error.message : "Falha ao calcular pricing",
      });
  }
}
