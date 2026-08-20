import { createHash } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PaymentService } from "../../../payment/service";
import { verifyMercadoPagoSignature } from "../../../payment/webhook-signature";

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const body = isObject(request.body) ? request.body : {};
  const url = new URL(request.url, "http://localhost");
  const nested =
    isObject(body.data) && typeof body.data.id === "string"
      ? body.data.id
      : undefined;
  const dataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? nested;
  const valid =
    process.env.MERCADO_PAGO_ENABLED === "true" &&
    process.env.MERCADO_PAGO_ENVIRONMENT === "TEST" &&
    verifyMercadoPagoSignature({
      signature: header(request.headers, "x-signature"),
      requestId: header(request.headers, "x-request-id"),
      dataId,
      secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    });
  if (!valid || !dataId) {
    response.status(401).json({ accepted: false });
    return;
  }
  const requestId = header(request.headers, "x-request-id") ?? "";
  const type = typeof body.type === "string" ? body.type : "order.updated";
  await new PaymentService(request.scope).processProviderEvent({
    provider: "MERCADO_PAGO",
    providerEventId: requestId,
    providerOrderId: dataId,
    type,
    payloadHash: createHash("sha256").update(`${type}:${dataId}`).digest("hex"),
  });
  response.status(200).json({ accepted: true });
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function header(
  headers: MedusaRequest["headers"],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}
