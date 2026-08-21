import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { parseOrReply } from "../../../http";

const schema = z.object({ trackingNumber: z.string().trim().min(3).max(100) });
export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const body = parseOrReply(schema, request.body, response);
  if (!body) return;
  try {
    response.json({
      tracking: await cjClientFromEnvironment().tracking({
        trackingNumber: body.trackingNumber,
      }),
    });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
