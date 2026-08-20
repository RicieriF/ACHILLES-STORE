import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export function GET(_request: MedusaRequest, response: MedusaResponse): void {
  response.status(200).json({ service: "commerce", status: "ok" });
}
