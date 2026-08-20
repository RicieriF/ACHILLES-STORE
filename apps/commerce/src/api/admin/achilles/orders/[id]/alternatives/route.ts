import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { FulfillmentService } from "../../../../../../fulfillment/service";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  response.json({
    alternatives: await new FulfillmentService(request.scope).alternatives(
      String(request.params.id),
    ),
  });
}
