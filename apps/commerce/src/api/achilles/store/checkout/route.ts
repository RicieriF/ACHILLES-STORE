import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { CheckoutService } from "../../../../checkout/service";
import { createCheckoutInput, sendCheckoutError } from "./http";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const input = createCheckoutInput.parse(request.body);
    response.status(201).json({
      checkout: await new CheckoutService(request.scope).create(input.cartId),
    });
  } catch (error) {
    sendCheckoutError(response, error);
  }
}
