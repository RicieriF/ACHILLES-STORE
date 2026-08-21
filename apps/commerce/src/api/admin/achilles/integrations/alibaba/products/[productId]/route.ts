import {
  alibabaClientFromEnvironment,
  sanitizeAlibabaError,
} from "@achilles/alibaba-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { normalizeAlibabaProduct } from "../../../../../../../integrations/provider-dto";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const productId = request.params.productId;
  if (!productId) {
    response
      .status(400)
      .json({ code: "VALIDATION_ERROR", message: "Product ID obrigatório" });
    return;
  }
  try {
    const raw = await alibabaClientFromEnvironment().product(productId);
    response.json({
      product: normalizeAlibabaProduct(raw),
      source: "ALIBABA_ICBU_DROPSHIPPING",
    });
  } catch (error) {
    response.status(503).json(sanitizeAlibabaError(error));
  }
}
