import { authenticate, defineMiddlewares } from "@medusajs/framework/http";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { PublicCatalogService } from "../catalog/service";

export async function blockImportedProductPublication(
  request: MedusaRequest,
  response: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  const body = request.body as Record<string, unknown> | undefined;
  if (body?.status !== ProductStatus.PUBLISHED) {
    next();
    return;
  }
  const id = request.params.id;
  if (!id) {
    next();
    return;
  }
  const products = request.scope.resolve<{
    retrieveProduct(
      id: string,
    ): Promise<{ metadata?: Record<string, unknown> | null }>;
  }>(Modules.PRODUCT);
  const product = await products.retrieveProduct(id);
  if (product.metadata?.achilles_import_draft_id) {
    const decision = await new PublicCatalogService(request.scope)
      .canPublishProduct(id)
      .catch(() => ({
        eligible: false as const,
        reasons: ["PUBLICATION_GATE_UNAVAILABLE"],
      }));
    if (!decision.eligible) {
      response.status(409).json({
        code: "IMPORTED_PRODUCT_PUBLICATION_BLOCKED",
        message:
          "Produto importado não atende todos os gates de publicação pública",
        reasons: decision.reasons,
      });
      return;
    }
  }
  next();
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/products/:id",
      method: "POST",
      middlewares: [blockImportedProductPublication],
    },
    {
      matcher: "/admin/achilles*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
  ],
});
