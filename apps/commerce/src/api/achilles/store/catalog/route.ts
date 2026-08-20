import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PublicCatalogService } from "../../../../catalog/service";

export async function GET(request: MedusaRequest, response: MedusaResponse) {
  const catalog = await new PublicCatalogService(request.scope).getCatalog();
  const query = typeof request.query.q === "string" ? request.query.q : "";
  const category =
    typeof request.query.category === "string" ? request.query.category : "";
  const normalizedQuery = query.trim();
  let products = catalog.products;
  if (normalizedQuery)
    products = await new PublicCatalogService(request.scope).search(
      normalizedQuery,
    );
  if (category)
    products = products.filter((product) =>
      product.categories.some((item) => item.handle === category),
    );
  response.setHeader("Cache-Control", "no-store");
  response.json({ ...catalog, products });
}
