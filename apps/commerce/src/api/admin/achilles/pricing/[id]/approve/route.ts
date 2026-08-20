import type { MedusaResponse } from "@medusajs/framework/http";
import {
  approveCostQuote,
  PricingError,
} from "../../../../../../pricing/service";
import { actorId, type AdminRequest } from "../../../http";

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json({
      approval: await approveCostQuote(
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
        code: error instanceof PricingError ? error.code : "APPROVAL_FAILED",
        message:
          error instanceof Error ? error.message : "Falha ao aprovar preço",
      });
  }
}
