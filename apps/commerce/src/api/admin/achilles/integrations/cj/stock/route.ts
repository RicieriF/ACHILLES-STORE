import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const vid = typeof request.query.vid === "string" ? request.query.vid : "";
  if (!vid) {
    response
      .status(400)
      .json({ code: "VALIDATION_ERROR", message: "VID obrigatório" });
    return;
  }
  try {
    response.json({
      stock: await cjClientFromEnvironment().stockByVid(vid),
      last_checked_at: new Date().toISOString(),
    });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
