import type { MedusaResponse } from "@medusajs/framework/http";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import {
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit, safeSnapshot } from "../../../audit";
import {
  actorId,
  notFound,
  parseOrReply,
  type AdminRequest,
} from "../../../http";
import { quickProductEditInput } from "../../../schemas";

type ProductRecord = {
  id: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(quickProductEditInput, request.body, response);
  if (!input) return;
  const productModule = request.scope.resolve<{
    retrieveProduct(id: string): Promise<ProductRecord>;
  }>(Modules.PRODUCT);
  const productId = request.params.id;
  if (!productId) {
    notFound(response, "Produto");
    return;
  }
  let current: ProductRecord;
  try {
    current = await productModule.retrieveProduct(productId);
  } catch {
    notFound(response, "Produto");
    return;
  }
  const metadata = {
    ...(current.metadata ?? {}),
    ...(input.featured === undefined ? {} : { featured: input.featured }),
  };
  const { result } = await updateProductsWorkflow(request.scope).run({
    input: {
      products: [
        {
          id: current.id,
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.category_id === undefined
            ? {}
            : { category_ids: [input.category_id] }),
          ...(input.image_urls === undefined
            ? {}
            : {
                images: input.image_urls.map((url) => ({ url })),
                thumbnail: input.image_urls[0] ?? null,
              }),
          ...(input.featured === undefined ? {} : { metadata }),
          ...(input.status === undefined
            ? {}
            : { status: ProductStatus.DRAFT }),
        },
      ],
    },
  });
  if (input.sku !== undefined || input.price_brl !== undefined) {
    await updateProductVariantsWorkflow(request.scope).run({
      input: {
        selector: { product_id: current.id },
        update: {
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          ...(input.price_brl === undefined
            ? {}
            : {
                prices:
                  input.price_brl === null
                    ? []
                    : [{ currency_code: "brl", amount: input.price_brl }],
              }),
        },
      },
    });
  }
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  if (input.availability !== undefined) {
    const offers = await domain.listSupplierOffers({
      product_id: current.id,
      is_primary: true,
    });
    if (offers[0]) {
      await domain.updateSupplierOffers({
        id: offers[0].id,
        availability: input.availability,
      });
    }
  }
  await recordAudit(domain, {
    action: "ADMIN_QUICK_PRODUCT_UPDATED",
    entityType: "product",
    entityId: current.id,
    actorId: actorId(request),
    summary: `Produto ${current.title} atualizado pelo editor rápido`,
    before: safeSnapshot(current),
    after: safeSnapshot(result[0] ?? { id: current.id }),
  });
  response.json({ product: result[0] });
}
