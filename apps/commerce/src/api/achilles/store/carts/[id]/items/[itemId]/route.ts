import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCartService } from "../../../../../../../cart/public-cart";
import {
  cartBody,
  positiveInteger,
  requiredId,
  sendCartError,
} from "../../../http";

export async function POST(request: MedusaRequest, response: MedusaResponse) {
  try {
    const body = cartBody(request.body);
    const cartId = requiredId(request.params.id, "cartId");
    const itemId = requiredId(request.params.itemId, "itemId");
    const quantity = positiveInteger(body.quantity, "quantity");
    response.json({
      cart: await new PublicCartService(request.scope).updateItem(
        cartId,
        itemId,
        quantity,
      ),
    });
  } catch (error) {
    sendCartError(response, error);
  }
}

export async function DELETE(request: MedusaRequest, response: MedusaResponse) {
  try {
    const cartId = requiredId(request.params.id, "cartId");
    const itemId = requiredId(request.params.itemId, "itemId");
    response.json({
      cart: await new PublicCartService(request.scope).removeItem(
        cartId,
        itemId,
      ),
    });
  } catch (error) {
    sendCartError(response, error);
  }
}
