import type { MedusaResponse } from "@medusajs/framework/http";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../../audit";
import { actorId, notFound, type AdminRequest } from "../../../../http";

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const id = request.params.id;
  if (!id) {
    notFound(response, "Produto");
    return;
  }
  const products = request.scope.resolve<{
    retrieveProduct(id: string): Promise<{
      id: string;
      title: string;
      metadata: Record<string, unknown> | null;
    }>;
  }>(Modules.PRODUCT);
  let product;
  try {
    product = await products.retrieveProduct(id);
  } catch {
    notFound(response, "Produto");
    return;
  }
  await updateProductsWorkflow(request.scope).run({
    input: {
      products: [
        {
          id,
          status: ProductStatus.DRAFT,
          metadata: {
            ...(product.metadata ?? {}),
            achilles_archived: true,
            achilles_archived_at: new Date().toISOString(),
          },
        },
      ],
    },
  });
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  await recordAudit(domain, {
    action: "ADMIN_PRODUCT_ARCHIVED",
    entityType: "product",
    entityId: id,
    actorId: actorId(request),
    summary: `Produto ${product.title} retirado de venda e arquivado`,
  });
  response.json({ archived: true, productId: id });
}
