import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sanitizedOperationalConfig } from "../../../../integrations/status";
export function GET(_request: MedusaRequest, response: MedusaResponse): void {
  response.json(sanitizedOperationalConfig());
}
