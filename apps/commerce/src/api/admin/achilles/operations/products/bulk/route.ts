import type { MedusaResponse } from "@medusajs/framework/http";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../audit";
import { actorId, parseOrReply, type AdminRequest } from "../../../http";
import { bulkProductInput } from "../../../schemas";

type ProductMetadata = { id: string; metadata: Record<string, unknown> | null };
export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(bulkProductInput, request.body, response);
  if (!input) return;
  if (input.action === "CATEGORY" && !input.category_id) {
    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Categoria é obrigatória para esta ação",
    });
    return;
  }
  const module = request.scope.resolve<{
    listProducts(filters: { id: string[] }): Promise<ProductMetadata[]>;
  }>(Modules.PRODUCT);
  const current = await module.listProducts({ id: input.product_ids });
  const products = current.map((product) => ({
    id: product.id,
    ...(input.action === "CATEGORY"
      ? { category_ids: [input.category_id as string] }
      : {}),
    ...(input.action === "FEATURE" || input.action === "UNFEATURE"
      ? {
          metadata: {
            ...(product.metadata ?? {}),
            featured: input.action === "FEATURE",
          },
        }
      : {}),
    ...(input.action === "DEACTIVATE" ? { status: ProductStatus.DRAFT } : {}),
  }));
  await updateProductsWorkflow(request.scope).run({ input: { products } });
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  await Promise.all(
    products.map((product) =>
      recordAudit(domain, {
        action: `ADMIN_PRODUCT_BULK_${input.action}`,
        entityType: "product",
        entityId: product.id,
        actorId: actorId(request),
        summary: `Ação segura em lote: ${input.action}`,
      }),
    ),
  );
  response.json({
    updated: products.map((product) => product.id),
    count: products.length,
  });
}
