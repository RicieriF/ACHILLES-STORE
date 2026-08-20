import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCartService } from "../../../../../../cart/public-cart";
import {
  cartBody,
  positiveInteger,
  requiredId,
  sendCartError,
} from "../../http";

export async function POST(request: MedusaRequest, response: MedusaResponse) {
  try {
    const body = cartBody(request.body);
    const cartId = requiredId(request.params.id, "cartId");
    const variantId = requiredId(body.variantId, "variantId");
    const quantity = positiveInteger(body.quantity, "quantity");
    response.json({
      cart: await new PublicCartService(request.scope).addItem(
        cartId,
        variantId,
        quantity,
      ),
    });
  } catch (error) {
    sendCartError(response, error);
  }
}
