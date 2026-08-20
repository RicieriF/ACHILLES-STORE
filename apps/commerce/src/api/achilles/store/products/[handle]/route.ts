import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCatalogService } from "../../../../../catalog/service";

export async function GET(request: MedusaRequest, response: MedusaResponse) {
  const handle = request.params.handle;
  if (!handle) {
    response.status(404).json({ code: "PRODUCT_NOT_FOUND" });
    return;
  }
  const product = await new PublicCatalogService(
    request.scope,
  ).getProductByHandle(handle);
  response.setHeader("Cache-Control", "no-store");
  if (!product) {
    response.status(404).json({ code: "PRODUCT_NOT_FOUND" });
    return;
  }
  response.json({ product });
}
