import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PaymentService } from "../../../../payment/service";
import { createPaymentSchema, sendPaymentError } from "./http";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const input = createPaymentSchema.parse(request.body);
    response.status(201).json({
      paymentIntent: await new PaymentService(request.scope).create(input),
    });
  } catch (error) {
    sendPaymentError(response, error);
  }
}
