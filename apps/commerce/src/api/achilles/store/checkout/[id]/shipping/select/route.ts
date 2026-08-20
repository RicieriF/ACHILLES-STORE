import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { CheckoutService } from "../../../../../../../checkout/service";
import { selectShippingInput, sendCheckoutError } from "../../../http";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const input = selectShippingInput.parse(request.body);
    response.json({
      checkout: await new CheckoutService(request.scope).selectShipping(
        request.params.id ?? "",
        input,
      ),
    });
  } catch (error) {
    sendCheckoutError(response, error);
  }
}
