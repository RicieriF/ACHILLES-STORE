import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import {
  FulfillmentError,
  FulfillmentService,
} from "../../../../../../fulfillment/service";

const schema = z
  .object({ action: z.enum(["CREATE", "SHIP", "DELIVER"]) })
  .strict();

export async function POST(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      code: "INVALID_SANDBOX_ACTION",
      message: "Ação sandbox inválida",
    });
    return;
  }
  const service = new FulfillmentService(request.scope);
  try {
    if (parsed.data.action === "CREATE")
      await service.executeSandbox(String(request.params.id));
    else
      await service.advanceSandbox(
        String(request.params.id),
        parsed.data.action === "SHIP" ? "SHIPPED" : "DELIVERED",
      );
    response.json({
      order: await service.adminDetail(String(request.params.id)),
      sandbox: true,
    });
  } catch (error) {
    if (error instanceof FulfillmentError) {
      response
        .status(error.status)
        .json({ code: error.code, message: error.message });
      return;
    }
    response.status(500).json({
      code: "SANDBOX_FAILED",
      message: "Falha no fulfillment sandbox",
    });
  }
}
