import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCartService } from "../../../../../cart/public-cart";
import { requiredId, sendCartError } from "../http";

export async function GET(request: MedusaRequest, response: MedusaResponse) {
  try {
    const id = requiredId(request.params.id, "cartId");
    response.json({
      cart: await new PublicCartService(request.scope).retrieve(id),
    });
  } catch (error) {
    sendCartError(response, error);
  }
}
