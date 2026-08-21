import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { parseOrReply } from "../../../http";

const schema = z.object({
  keyword: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().max(80).optional(),
  countryCode: z.string().trim().length(2).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const query = parseOrReply(schema, request.query, response);
  if (!query) return;
  try {
    const products = await cjClientFromEnvironment().searchProducts({
      keyWord: query.keyword,
      categoryId: query.categoryId,
      countryCode: query.countryCode,
      startSellPrice: query.minPrice,
      endSellPrice: query.maxPrice,
      page: query.page,
      size: query.size,
    });
    response.json({ products, source: "CJ_API_V2" });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
