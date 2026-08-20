import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { CheckoutService } from "../../../../../../../checkout/service";
import { sendCheckoutError } from "../../../http";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json({
      checkout: await new CheckoutService(request.scope).quoteShipping(
        request.params.id ?? "",
      ),
    });
  } catch (error) {
    sendCheckoutError(response, error);
  }
}
