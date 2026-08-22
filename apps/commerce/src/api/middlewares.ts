import { authenticate, defineMiddlewares } from "@medusajs/framework/http";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ProductStatus } from "@medusajs/framework/utils";
import { humanPublicationReasons } from "../admin-operations/publication";
import { PublicCatalogService } from "../catalog/service";
import { publicRateLimit } from "./public-rate-limit";

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
  const decision = await new PublicCatalogService(request.scope)
    .canPublishProduct(id)
    .catch(() => ({
      eligible: false as const,
      reasons: ["PUBLICATION_GATE_UNAVAILABLE"],
    }));
  if (!decision.eligible) {
    response.status(409).json({
      code: "PRODUCT_PUBLICATION_BLOCKED",
      message: "Ainda não pode ser publicado:",
      reasons: humanPublicationReasons(decision.reasons),
    });
    return;
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
    {
      matcher: "/achilles/store/checkout*",
      middlewares: [publicRateLimit],
    },
    {
      matcher: "/achilles/store/payment-intents*",
      middlewares: [publicRateLimit],
    },
    {
      matcher: "/achilles/store/shipping*",
      middlewares: [publicRateLimit],
    },
    {
      matcher: "/achilles/store/orders*",
      middlewares: [publicRateLimit],
    },
    {
      matcher: "/webhooks/mercado-pago",
      middlewares: [publicRateLimit],
    },
  ],
});
