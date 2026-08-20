import type { MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { actorId, type AdminRequest } from "../../../http";
import {
  FulfillmentError,
  FulfillmentService,
} from "../../../../../../fulfillment/service";

const inputSchema = z.object({ confirmed: z.literal(true) }).strict();

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const parsed = inputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      code: "EXPLICIT_CONFIRMATION_REQUIRED",
      message: "Confirmação explícita obrigatória",
    });
    return;
  }
  try {
    const approval = await new FulfillmentService(request.scope).approve(
      String(request.params.id),
      actorId(request) ?? "authenticated-admin",
    );
    response.json({ approval, realExecutionEnabled: false });
  } catch (error) {
    if (error instanceof FulfillmentError) {
      response
        .status(error.status)
        .json({ code: error.code, message: error.message });
      return;
    }
    response
      .status(500)
      .json({ code: "APPROVAL_FAILED", message: "Não foi possível aprovar" });
  }
}
