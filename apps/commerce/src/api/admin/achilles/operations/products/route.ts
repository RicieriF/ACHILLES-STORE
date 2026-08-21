import type { MedusaResponse } from "@medusajs/framework/http";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../modules/supplier-domain/service";
import { recordAudit } from "../../audit";
import { actorId, parseOrReply, type AdminRequest } from "../../http";
import {
  quickProductCreateInput,
  type QuickProductCreateInput,
} from "../../schemas";

type Category = { id: string; name?: string; handle?: string };

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(quickProductCreateInput, request.body, response);
  if (!input) return;
  if (input.test_fixture && process.env.APP_ENV === "production") {
    response.status(403).json({
      code: "TEST_FIXTURE_FORBIDDEN",
      message: "Fixtures de teste são proibidas em produção",
    });
    return;
  }
  const fulfillment = request.scope.resolve<{
    listShippingProfiles(): Promise<Array<{ id: string }>>;
  }>(Modules.FULFILLMENT);
  const products = request.scope.resolve<{
    retrieveProductCategory(id: string): Promise<Category>;
  }>(Modules.PRODUCT);
  const [[shippingProfile], category] = await Promise.all([
    fulfillment.listShippingProfiles(),
    products.retrieveProductCategory(input.category_id),
  ]);
  if (!shippingProfile) {
    response.status(409).json({
      code: "SHIPPING_PROFILE_MISSING",
      message: "Configure um perfil de entrega antes de criar produtos",
    });
    return;
  }
  const variants = buildVariants(input);
  const { result } = await createProductsWorkflow(request.scope).run({
    input: {
      products: [
        {
          title: input.title,
          description: input.description,
          status: ProductStatus.DRAFT,
          shipping_profile_id: shippingProfile.id,
          category_ids: [category.id],
          sales_channels: [],
          images: input.image_urls.map((url) => ({ url })),
          ...(input.image_urls[0] ? { thumbnail: input.image_urls[0] } : {}),
          metadata: {
            fulfillment_mode: input.fulfillment_mode,
            achilles_quick_create: true,
            ...(input.test_fixture ? { achilles_test_fixture: true } : {}),
          },
          options: variants.options,
          variants: variants.items,
        },
      ],
    },
  });
  const product = result[0];
  if (!product) throw new Error("PRODUCT_CREATION_DID_NOT_RETURN_PRODUCT");
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const edged =
    category.handle === "cutelaria" ||
    (category.name ?? "").toLocaleLowerCase("pt-BR").includes("cutelaria");
  const policy = await domain.createProductPolicies({
    product_id: product.id,
    fulfillment_mode: input.fulfillment_mode,
    sensitivity: edged ? "EDGED_TOOL" : "ORDINARY",
    compliance_status: edged ? "REVIEW_REQUIRED" : "PENDING",
    compliance_notes: edged
      ? "Cutelaria exige revisão humana antes de publicação."
      : null,
    commercial_readiness: input.supplier_id
      ? "PRICING_REQUIRED"
      : "DATA_INCOMPLETE",
  });
  let offerId: string | null = null;
  if (
    input.supplier_id &&
    input.supplier_product_id &&
    input.source_url &&
    input.supplier_cost
  ) {
    const offer = await domain.createSupplierOffers({
      supplier_id: input.supplier_id,
      product_id: product.id,
      supplier_product_id: input.supplier_product_id,
      source_url: input.source_url,
      currency: "USD",
      unit_cost: input.supplier_cost,
      moq: 1,
      availability: input.availability,
      status: "ACTIVE",
      fulfillment_mode: input.fulfillment_mode,
      private_label_supported: false,
      is_primary: true,
    });
    offerId = offer.id;
    await domain.createCostQuotes({
      supplier_offer_id: offer.id,
      status: "INCOMPLETE",
      source_currency: "USD",
      supplier_unit_cost: input.supplier_cost,
      moq: 1,
      assumptions: {
        items: ["Criado pelo cadastro rápido; revisar premissas."],
      },
    });
  }
  await recordAudit(domain, {
    action: "ADMIN_QUICK_PRODUCT_CREATED",
    entityType: "product",
    entityId: product.id,
    actorId: actorId(request),
    summary: `Produto DRAFT ${input.title} criado pelo fluxo rápido`,
    metadata: { policy_id: policy.id, offer_id: offerId },
  });
  response.status(201).json({
    product: { id: product.id, title: product.title, status: product.status },
    policy,
    offerId,
  });
}

function buildVariants(input: QuickProductCreateInput) {
  const supplied = input.variants.length
    ? input.variants
    : [{ title: "Padrão", sku: input.sku }];
  const dimensions = [
    ["Cor", "color"],
    ["Tamanho", "size"],
    ["Alimentação", "power"],
  ] as const;
  const activeDimensions = dimensions.filter(([, field]) =>
    supplied.some((variant) => Boolean(variant[field]?.trim())),
  );
  if (!activeDimensions.length) {
    return {
      options: [{ title: "Modelo", values: ["Padrão"] }],
      items: supplied.map((variant) => ({
        title: variant.title,
        sku: variant.sku,
        manage_inventory: false,
        options: { Modelo: "Padrão" },
        prices:
          input.price_brl === null
            ? []
            : [{ currency_code: "brl", amount: input.price_brl }],
      })),
    };
  }
  return {
    options: activeDimensions.map(([title, field]) => ({
      title,
      values: [
        ...new Set(
          supplied.map((variant) => variant[field]?.trim() || "Padrão"),
        ),
      ],
    })),
    items: supplied.map((variant) => ({
      title: variant.title,
      sku: variant.sku,
      manage_inventory: false,
      options: Object.fromEntries(
        activeDimensions.map(([title, field]) => [
          title,
          variant[field]?.trim() || "Padrão",
        ]),
      ),
      prices:
        input.price_brl === null
          ? []
          : [{ currency_code: "brl", amount: input.price_brl }],
    })),
  };
}
