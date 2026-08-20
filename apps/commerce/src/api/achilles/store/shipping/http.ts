import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { ShippingQuoteEngineError } from "../../../../shipping/engine";
import { PostalCodeError } from "../../../../shipping/postal-code";

export const publicShippingInput = z
  .object({
    variantId: z.string().trim().min(3).max(128).optional(),
    cartId: z.string().trim().min(3).max(128).optional(),
    quantity: z.number().int().min(1).max(99).default(1),
    postalCode: z.string().trim().min(8).max(9),
  })
  .strict()
  .refine((value) => Boolean(value.variantId) !== Boolean(value.cartId), {
    message: "Informe variantId ou cartId, exclusivamente",
  });

export function sendShippingError(
  response: MedusaResponse,
  error: unknown,
): void {
  if (error instanceof z.ZodError) {
    response.status(400).json({
      code: "INVALID_SHIPPING_INPUT",
      message: "CEP ou parâmetros de cotação inválidos",
    });
    return;
  }
  if (error instanceof PostalCodeError) {
    response.status(400).json({
      code: "INVALID_SHIPPING_INPUT",
      message: error.message,
    });
    return;
  }
  if (error instanceof ShippingQuoteEngineError) {
    response.status(error.code === "PRODUCT_NOT_PUBLIC" ? 404 : 409).json({
      code: error.code,
      message: error.message,
    });
    return;
  }
  response.status(500).json({
    code: "SHIPPING_QUOTE_FAILED",
    message: "Não foi possível calcular a entrega neste momento",
  });
}
