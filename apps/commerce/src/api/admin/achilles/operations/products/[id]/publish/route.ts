import type { MedusaResponse } from "@medusajs/framework/http";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { brazilCommerceDefaults } from "@achilles/domain";
import { humanPublicationReasons } from "../../../../../../../admin-operations/publication";
import { PublicCatalogService } from "../../../../../../../catalog/service";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../../audit";
import { actorId, notFound, type AdminRequest } from "../../../../http";

type ProductModule = {
  retrieveProduct(
    id: string,
    config?: object,
  ): Promise<{
    id: string;
    title: string;
    status: string;
    metadata?: Record<string, unknown> | null;
    sales_channels?: Array<{ id: string }>;
  }>;
};

type SalesChannelModule = {
  listSalesChannels(filters: { name: string }): Promise<Array<{ id: string }>>;
};

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const productId = request.params.id;
  if (!productId) {
    notFound(response, "Produto");
    return;
  }
  const products = request.scope.resolve<ProductModule>(Modules.PRODUCT);
  let product;
  try {
    product = await products.retrieveProduct(productId, {
      relations: ["sales_channels"],
    });
  } catch {
    notFound(response, "Produto");
    return;
  }
  if (product.metadata?.achilles_archived === true) {
    response.status(409).json({
      code: "PRODUCT_ARCHIVED",
      message: "Ainda não pode ser publicado:",
      reasons: ["Produto arquivado"],
    });
    return;
  }
  const salesChannels = request.scope.resolve<SalesChannelModule>(
    Modules.SALES_CHANNEL,
  );
  const [publicChannel] = await salesChannels.listSalesChannels({
    name: brazilCommerceDefaults.salesChannelName,
  });
  if (
    publicChannel &&
    !product.sales_channels?.some((item) => item.id === publicChannel.id)
  )
    await updateProductsWorkflow(request.scope).run({
      input: {
        products: [
          { id: productId, sales_channels: [{ id: publicChannel.id }] },
        ],
      },
    });
  const decision = await new PublicCatalogService(request.scope)
    .canPublishProduct(productId)
    .catch(() => ({
      eligible: false as const,
      reasons: ["PUBLICATION_GATE_UNAVAILABLE"],
    }));
  if (!decision.eligible) {
    if (publicChannel)
      await updateProductsWorkflow(request.scope)
        .run({
          input: { products: [{ id: productId, sales_channels: [] }] },
        })
        .catch(() => undefined);
    response.status(409).json({
      code: "PRODUCT_PUBLICATION_BLOCKED",
      message: "Ainda não pode ser publicado:",
      reasons: humanPublicationReasons(decision.reasons),
    });
    return;
  }
  await updateProductsWorkflow(request.scope).run({
    input: {
      products: [{ id: productId, status: ProductStatus.PUBLISHED }],
    },
  });
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  await recordAudit(domain, {
    action: "ADMIN_PRODUCT_PUBLISHED",
    entityType: "product",
    entityId: productId,
    actorId: actorId(request),
    summary: `Produto ${product.title} publicado na vitrine`,
  });
  response.json({ published: true, productId });
}
