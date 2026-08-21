import {
  alibabaClientFromEnvironment,
  sanitizeAlibabaError,
} from "@achilles/alibaba-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { parseOrReply } from "../../../http";
import { normalizeAlibabaTracking } from "../../../../../../integrations/provider-dto";

const schema = z.object({ tradeId: z.string().regex(/^\d{3,30}$/) });
export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const body = parseOrReply(schema, request.body, response);
  if (!body) return;
  try {
    response.json({
      tracking: normalizeAlibabaTracking(
        await alibabaClientFromEnvironment().tracking(body.tradeId),
      ),
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    response.status(503).json(sanitizeAlibabaError(error));
  }
}
