import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { PaymentError } from "../../../../payment/service";

export const createPaymentSchema = z
  .object({
    checkoutId: z.string().trim().min(10).max(128),
    method: z.enum(["PIX", "CARD"]),
    attemptId: z.uuid(),
    cpf: z.string().trim().max(20).optional(),
    card: z
      .object({
        token: z.string().trim().min(5).max(512),
        paymentMethodId: z
          .string()
          .trim()
          .regex(/^[a-z0-9_-]{2,32}$/i),
        installments: z.number().int().min(1).max(24),
      })
      .strict()
      .optional(),
  })
  .strict();

export function sendPaymentError(
  response: MedusaResponse,
  error: unknown,
): void {
  if (error instanceof z.ZodError) {
    response.status(400).json({
      code: "INVALID_PAYMENT_INPUT",
      message: "Revise os dados do pagamento",
    });
    return;
  }
  if (error instanceof PaymentError) {
    response
      .status(error.status)
      .json({ code: error.code, message: error.message });
    return;
  }
  response.status(500).json({
    code: "PAYMENT_FAILED",
    message: "Não foi possível processar o pagamento",
  });
}
