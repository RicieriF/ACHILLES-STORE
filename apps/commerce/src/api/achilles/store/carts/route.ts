import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCartService } from "../../../../cart/public-cart";
import { sendCartError } from "./http";

export async function POST(request: MedusaRequest, response: MedusaResponse) {
  try {
    response.status(201).json({
      cart: await new PublicCartService(request.scope).create(),
    });
  } catch (error) {
    sendCartError(response, error);
  }
}
