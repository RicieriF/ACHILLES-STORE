import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { actorId, type AdminRequest } from "../../../http";
import {
  FulfillmentError,
  FulfillmentService,
} from "../../../../../../fulfillment/service";

const schema = z
  .object({ groupId: z.string().min(8), offerId: z.string().min(8) })
  .strict();

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({ code: "INVALID_ALTERNATIVE", message: "Alternativa inválida" });
    return;
  }
  try {
    const service = new FulfillmentService(request.scope);
    await service.selectAlternative(
      String(request.params.id),
      parsed.data.groupId,
      parsed.data.offerId,
      actorId(request) ?? "authenticated-admin",
    );
    response.json(await service.adminDetail(String(request.params.id)));
  } catch (error) {
    if (error instanceof FulfillmentError) {
      response
        .status(error.status)
        .json({ code: error.code, message: error.message });
      return;
    }
    response.status(500).json({
      code: "ALTERNATIVE_FAILED",
      message: "Não foi possível trocar a oferta",
    });
  }
}
