import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { CheckoutError } from "../../../../checkout/service";
import { PostalCodeError } from "../../../../shipping/postal-code";

export const createCheckoutInput = z
  .object({ cartId: z.string().trim().min(3).max(128) })
  .strict();
export const selectShippingInput = z
  .object({
    groupId: z.string().trim().min(3).max(80),
    quoteId: z.string().trim().min(3).max(128),
  })
  .strict();

export function sendCheckoutError(
  response: MedusaResponse,
  error: unknown,
): void {
  if (error instanceof z.ZodError || error instanceof PostalCodeError) {
    response.status(400).json({
      code: "INVALID_CHECKOUT_INPUT",
      message: "Revise os dados informados",
    });
    return;
  }
  if (error instanceof CheckoutError) {
    response
      .status(error.status)
      .json({ code: error.code, message: error.message });
    return;
  }
  response.status(500).json({
    code: "CHECKOUT_FAILED",
    message: "Não foi possível atualizar o checkout",
  });
}
