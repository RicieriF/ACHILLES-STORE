import type { MedusaResponse } from "@medusajs/framework/http";
import { extensionCards } from "../../../../../admin-operations/extensions";
import type { AdminRequest } from "../../http";

export function GET(_request: AdminRequest, response: MedusaResponse): void {
  response.json({ extensions: extensionCards() });
}
