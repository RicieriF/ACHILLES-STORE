import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { FulfillmentService } from "../../../../fulfillment/service";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  response.json({
    orders: await new FulfillmentService(request.scope).listAdmin(),
  });
}
