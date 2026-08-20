import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  PaymentError,
  PaymentService,
} from "../../../../../../payment/service";
import { sendPaymentError } from "../../http";

const calls = new Map<string, number>();
export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const id = request.params.id ?? "";
    const last = calls.get(id) ?? 0;
    if (Date.now() - last < 2_000)
      throw new PaymentError(
        "POLL_RATE_LIMITED",
        "Aguarde antes de atualizar novamente",
        429,
      );
    calls.set(id, Date.now());
    response.json({
      paymentIntent: await new PaymentService(request.scope).poll(id),
    });
  } catch (error) {
    sendPaymentError(response, error);
  }
}
