import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { CheckoutService } from "../../../../../../checkout/service";
import { sendCheckoutError } from "../../http";

export async function PATCH(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json({
      checkout: await new CheckoutService(request.scope).updateAddress(
        request.params.id ?? "",
        request.body,
      ),
    });
  } catch (error) {
    sendCheckoutError(response, error);
  }
}
