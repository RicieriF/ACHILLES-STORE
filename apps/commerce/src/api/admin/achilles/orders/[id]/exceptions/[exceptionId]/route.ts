import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { actorId, type AdminRequest } from "../../../../http";
import {
  FulfillmentError,
  FulfillmentService,
} from "../../../../../../../fulfillment/service";

const schema = z
  .object({ status: z.enum(["ACKNOWLEDGED", "RESOLVED"]) })
  .strict();

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      code: "INVALID_EXCEPTION_STATUS",
      message: "Status de exceção inválido",
    });
    return;
  }
  try {
    const service = new FulfillmentService(request.scope);
    await service.updateException(
      String(request.params.id),
      String(request.params.exceptionId),
      parsed.data.status,
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
      code: "EXCEPTION_UPDATE_FAILED",
      message: "Não foi possível atualizar a exceção",
    });
  }
}
