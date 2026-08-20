import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  FulfillmentError,
  FulfillmentService,
} from "../../../../../fulfillment/service";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json(
      await new FulfillmentService(request.scope).adminDetail(
        String(request.params.id),
      ),
    );
  } catch (error) {
    if (error instanceof FulfillmentError) {
      response
        .status(error.status)
        .json({ code: error.code, message: error.message });
      return;
    }
    response
      .status(500)
      .json({ code: "ORDER_UNAVAILABLE", message: "Pedido indisponível" });
  }
}
