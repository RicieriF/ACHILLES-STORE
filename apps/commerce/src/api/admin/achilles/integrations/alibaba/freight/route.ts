import {
  alibabaClientFromEnvironment,
  sanitizeAlibabaError,
} from "@achilles/alibaba-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { parseOrReply } from "../../../http";
import { normalizeAlibabaFreight } from "../../../../../../integrations/provider-dto";

const schema = z.object({
  productId: z.string().regex(/^\d{3,30}$/),
  quantity: z.number().int().positive().max(999),
  zipCode: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  dispatchLocation: z.enum(["CN", "US"]).optional(),
});
export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const body = parseOrReply(schema, request.body, response);
  if (!body) return;
  try {
    const requestBody = {
      productId: body.productId,
      quantity: body.quantity,
      ...(body.zipCode ? { zipCode: body.zipCode } : {}),
      ...(body.dispatchLocation
        ? { dispatchLocation: body.dispatchLocation }
        : {}),
    };
    response.json({
      quotes: normalizeAlibabaFreight(
        await alibabaClientFromEnvironment().freight(requestBody),
      ),
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    response.status(503).json(sanitizeAlibabaError(error));
  }
}
