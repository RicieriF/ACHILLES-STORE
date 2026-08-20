import { createHash } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { PaymentService } from "../../../payment/service";
import { verifyMercadoPagoSignature } from "../../../payment/webhook-signature";

const schema = z
  .object({
    paymentIntentId: z.string().startsWith("pay_"),
    status: z.enum(["PENDING", "PAID", "FAILED", "EXPIRED"]),
    eventId: z.string().min(3).max(128),
  })
  .strict();
export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  if (process.env.PAYMENT_TEST_PROVIDER_ENABLED !== "true") {
    response.status(404).json({ accepted: false });
    return;
  }
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ accepted: false });
    return;
  }
  const valid = verifyMercadoPagoSignature({
    signature: header(request.headers, "x-signature"),
    requestId: parsed.data.eventId,
    dataId: parsed.data.paymentIntentId,
    secret: process.env.PAYMENT_TEST_WEBHOOK_SECRET,
  });
  if (!valid) {
    response.status(401).json({ accepted: false });
    return;
  }
  await new PaymentService(request.scope).processTestEvent({
    paymentIntentId: parsed.data.paymentIntentId,
    providerEventId: parsed.data.eventId,
    status: parsed.data.status,
    payloadHash: createHash("sha256")
      .update(`${parsed.data.paymentIntentId}:${parsed.data.status}`)
      .digest("hex"),
  });
  response.json({ accepted: true });
}
function header(
  headers: MedusaRequest["headers"],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}
