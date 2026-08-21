import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  _request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    response.json({
      warehouses: await cjClientFromEnvironment().warehouses(),
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
