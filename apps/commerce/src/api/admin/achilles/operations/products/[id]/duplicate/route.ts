import type { MedusaResponse } from "@medusajs/framework/http";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../../../audit";
import { actorId, notFound, type AdminRequest } from "../../../../http";

type CopyProduct = {
  id: string;
  title: string;
  description: string | null;
  subtitle: string | null;
  material: string | null;
  metadata: Record<string, unknown> | null;
  images: Array<{ url: string }>;
  categories: Array<{ id: string }>;
  options: Array<{
    id: string;
    title: string;
    values: Array<{ value: string }>;
  }>;
  variants: Array<{
    title: string;
    sku: string | null;
    options: Array<{ option_id: string; value: string }>;
  }>;
};

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
    retrieveProduct(
      id: string,
      config: { relations: string[] },
    ): Promise<CopyProduct>;
  }>(Modules.PRODUCT);
  const fulfillment = request.scope.resolve<{
    listShippingProfiles(): Promise<Array<{ id: string }>>;
  }>(Modules.FULFILLMENT);
  let source: CopyProduct;
  try {
    source = await products.retrieveProduct(id, {
      relations: ["images", "categories", "options.values", "variants.options"],
    });
  } catch {
    notFound(response, "Produto");
    return;
  }
  const [shippingProfile] = await fulfillment.listShippingProfiles();
  if (!shippingProfile) {
    response.status(409).json({
      code: "SHIPPING_PROFILE_MISSING",
      message: "Configure um perfil de entrega",
    });
    return;
  }
  const optionTitles = new Map(
    source.options.map((option) => [option.id, option.title]),
  );
  const created = await createProductsWorkflow(request.scope).run({
    input: {
      products: [
        {
          title: `${source.title} — Cópia`,
          description: source.description,
          subtitle: source.subtitle,
          material: source.material,
          status: ProductStatus.DRAFT,
          shipping_profile_id: shippingProfile.id,
          category_ids: source.categories.map((category) => category.id),
          images: source.images.map((image) => ({ url: image.url })),
          thumbnail: source.images[0]?.url ?? null,
          sales_channels: [],
          metadata: {
            ...(source.metadata ?? {}),
            featured: false,
            duplicated_from: source.id,
          },
          options: source.options.map((option) => ({
            title: option.title,
            values: option.values.map((value) => value.value),
          })),
          variants: source.variants.map((variant, index) => ({
            title: variant.title,
            sku: variant.sku
              ? `${variant.sku}-COPY-${String(Date.now())}-${String(index + 1)}`
              : null,
            manage_inventory: false,
            options: Object.fromEntries(
              variant.options.map((option) => [
                optionTitles.get(option.option_id) ?? "Modelo",
                option.value,
              ]),
            ),
            prices: [],
          })),
        },
      ],
    },
  });
  const copy = created.result[0];
  if (!copy) throw new Error("PRODUCT_DUPLICATION_DID_NOT_RETURN_PRODUCT");
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const sourcePolicy = (
    await domain.listProductPolicies({ product_id: source.id })
  )[0];
  await domain.createProductPolicies({
    product_id: copy.id,
    fulfillment_mode:
      sourcePolicy?.fulfillment_mode ?? "PRIVATE_LABEL_DROPSHIP",
    sensitivity: sourcePolicy?.sensitivity ?? "ORDINARY",
    compliance_status:
      sourcePolicy?.sensitivity === "EDGED_TOOL"
        ? "REVIEW_REQUIRED"
        : sourcePolicy?.sensitivity === "CONTROLLED_ITEM"
          ? "BLOCKED"
          : "PENDING",
    compliance_notes: "Duplicado sem copiar aprovação; requer nova revisão.",
    commercial_readiness: "DATA_INCOMPLETE",
  });
  await recordAudit(domain, {
    action: "ADMIN_PRODUCT_DUPLICATED",
    entityType: "product",
    entityId: copy.id,
    actorId: actorId(request),
    summary: `Produto duplicado de ${source.id} sem ofertas, estoque ou preços aprovados`,
    metadata: { source_product_id: source.id },
  });
  response
    .status(201)
    .json({ product: { id: copy.id, title: copy.title, status: copy.status } });
}
