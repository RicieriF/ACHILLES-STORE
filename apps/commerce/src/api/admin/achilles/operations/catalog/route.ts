import type { MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  listOperationalProducts,
  type OperationsDatabase,
} from "../../../../../admin-operations/service";
import { parseOrReply, type AdminRequest } from "../../http";

const querySchema = z.object({
  q: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const query = parseOrReply(querySchema, request.query, response);
  if (!query) return;
  const database = request.scope.resolve<OperationsDatabase>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  response.json({
    ...(await listOperationalProducts(database, {
      limit: query.limit,
      offset: query.offset,
      ...(query.q ? { q: query.q } : {}),
    })),
    limit: query.limit,
    offset: query.offset,
    storefrontUrl: process.env.STOREFRONT_BASE_URL?.trim() || null,
  });
}
