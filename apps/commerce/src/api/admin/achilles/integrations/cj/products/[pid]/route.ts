import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const pid = request.params.pid;
  if (!pid) {
    response
      .status(400)
      .json({ code: "VALIDATION_ERROR", message: "PID obrigatório" });
    return;
  }
  try {
    const product = await cjClientFromEnvironment().product(pid);
    response.json({ product, source: "CJ_API_V2" });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
