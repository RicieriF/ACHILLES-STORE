import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PaymentService } from "../../../../../payment/service";
import { sendPaymentError } from "../http";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json({
      paymentIntent: await new PaymentService(request.scope).retrieve(
        request.params.id ?? "",
      ),
    });
  } catch (error) {
    sendPaymentError(response, error);
  }
}
