import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  CustomerOrderError,
  CustomerOrderService,
} from "../../../../../orders/customer-order-service";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const reference = request.params.reference ?? "";
  const token =
    typeof request.query.token === "string" ? request.query.token : "";
  if (!/^ACH-\d{4}-\d{6,}$/.test(reference) || token.length < 32) {
    response
      .status(404)
      .json({ code: "ORDER_NOT_FOUND", message: "Pedido não encontrado" });
    return;
  }
  try {
    response.json({
      order: await new CustomerOrderService(request.scope).retrievePublic(
        reference,
        token,
      ),
    });
  } catch (error) {
    if (error instanceof CustomerOrderError) {
      response
        .status(error.status)
        .json({ code: error.code, message: error.message });
      return;
    }
    response.status(500).json({
      code: "ORDER_UNAVAILABLE",
      message: "Pedido temporariamente indisponível",
    });
  }
}
