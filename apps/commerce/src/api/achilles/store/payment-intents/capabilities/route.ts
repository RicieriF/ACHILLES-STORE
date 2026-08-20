import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { paymentCapabilities } from "../../../../../payment/provider";

export function GET(_request: MedusaRequest, response: MedusaResponse): void {
  response.json({ capabilities: paymentCapabilities() });
}
