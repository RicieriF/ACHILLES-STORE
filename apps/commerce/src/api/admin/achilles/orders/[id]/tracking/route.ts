import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import {
  FulfillmentError,
  FulfillmentService,
} from "../../../../../../fulfillment/service";
import { actorId, parseOrReply, type AdminRequest } from "../../../http";

const schema = z.object({
  carrier: z.string().trim().min(2).max(80),
  tracking_number: z.string().trim().min(4).max(80),
  tracking_url: z.url().max(500).nullable().optional(),
});

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(schema, request.body, response);
  if (!input) return;
  try {
    const service = new FulfillmentService(request.scope);
    await service.registerTracking(
      String(request.params.id),
      {
        carrier: input.carrier,
        trackingNumber: input.tracking_number,
        trackingUrl: input.tracking_url ?? null,
      },
      actorId(request),
    );
    response.json({
      order: await service.adminDetail(String(request.params.id)),
    });
  } catch (error) {
    if (error instanceof FulfillmentError) {
      response
        .status(error.status)
        .json({ code: error.code, message: error.message });
      return;
    }
    response.status(500).json({
      code: "TRACKING_FAILED",
      message: "Não foi possível registrar o rastreio",
    });
  }
}
