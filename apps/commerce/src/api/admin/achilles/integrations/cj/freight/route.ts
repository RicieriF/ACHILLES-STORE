import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { parseOrReply } from "../../../http";

const schema = z.object({
  startCountryCode: z.string().length(2).default("CN"),
  endCountryCode: z.literal("BR"),
  zip: z.string().regex(/^\d{8}$/),
  products: z
    .array(
      z.object({
        vid: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const body = parseOrReply(schema, request.body, response);
  if (!body) return;
  try {
    response.json({ quotes: await cjClientFromEnvironment().freight(body) });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
