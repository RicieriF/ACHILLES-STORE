import { Modules, ProductStatus } from "@medusajs/framework/utils";
import type { MedusaResponse } from "@medusajs/framework/http";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { z } from "zod";
import { SUPPLIER_DOMAIN_MODULE } from "../../../../../../modules/supplier-domain";
import type SupplierDomainModuleService from "../../../../../../modules/supplier-domain/service";
import { testFixtureMetadata } from "../../../../../../lib/test-fixture";
import { actorId, parseOrReply, type AdminRequest } from "../../../http";
import { recordAudit } from "../../../audit";

const schema = z.object({
  pid: z.string().trim().min(1),
  title: z.string().trim().min(2).max(250),
  description: z.string().max(20_000).optional().default(""),
  images: z.array(z.url()).max(20).default([]),
  sourceUrl: z.url(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  sourceCost: z.string().regex(/^\d+(\.\d{1,4})?$/),
  variants: z
    .array(
      z.object({
        vid: z.string().min(1),
        sku: z.string().min(1),
        title: z.string().min(1),
      }),
    )
    .min(1),
  stockSnapshot: z.unknown().optional(),
  warehouse: z.string().optional(),
  test_fixture: z.boolean().optional().default(false),
});

export async function POST(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const input = parseOrReply(schema, request.body, response);
  if (!input) return;
  const fulfillment = request.scope.resolve<{
    listShippingProfiles(): Promise<Array<{ id: string }>>;
  }>(Modules.FULFILLMENT);
  const [profile] = await fulfillment.listShippingProfiles();
  if (!profile) {
    response.status(409).json({
      code: "SHIPPING_PROFILE_MISSING",
      message: "Configure um perfil de entrega.",
    });
    return;
  }
  const domain = request.scope.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const existing = await domain.listSupplierOffers({
    supplier_product_id: input.pid,
  });
  if (existing[0]) {
    response.status(409).json({
      code: "CJ_PRODUCT_ALREADY_IMPORTED",
      message: "Este produto CJ já possui oferta vinculada.",
    });
    return;
  }
  const { result } = await createProductsWorkflow(request.scope).run({
    input: {
      products: [
        {
          title: input.title,
          description: input.description || null,
          status: ProductStatus.DRAFT,
          shipping_profile_id: profile.id,
          sales_channels: [],
          images: input.images.map((url) => ({ url })),
          metadata: testFixtureMetadata({
            supplier_provider: "CJ",
            supplier_product_id: input.pid,
            commercial_readiness: "PRICING_REQUIRED",
            ...(input.test_fixture ? { achilles_test_fixture: true } : {}),
          }),
          options: [
            {
              title: "Variação CJ",
              values: input.variants.map((item) => item.title),
            },
          ],
          variants: input.variants.map((item) => ({
            title: item.title,
            sku: item.sku,
            manage_inventory: false,
            prices: [],
            options: { "Variação CJ": item.title },
          })),
        },
      ],
    },
  });
  const product = result[0];
  if (!product) throw new Error("PRODUCT_CREATION_DID_NOT_RETURN_PRODUCT");
  let [supplier] = await domain.listSuppliers({
    provider: "CJ",
    name: "[PENDENTE] CJdropshipping",
  });
  supplier ??= await domain.createSuppliers({
    name: "[PENDENTE] CJdropshipping",
    provider: "CJ",
    status: "INACTIVE",
    country_code: "CN",
    notes: "Fornecedor empresarial deve ser confirmado manualmente.",
    metadata: { platform: "CJ" },
  });
  const offer = await domain.createSupplierOffers({
    supplier_id: supplier.id,
    product_id: product.id,
    supplier_product_id: input.pid,
    source_url: input.sourceUrl,
    canonical_source_url: input.sourceUrl,
    currency: input.currency,
    unit_cost: input.sourceCost,
    moq: 1,
    availability: "UNKNOWN",
    status: "ACTIVE",
    fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
    private_label_supported: false,
    is_primary: true,
    freight_metadata: {
      warehouse: input.warehouse ?? null,
      stock_snapshot: input.stockSnapshot ?? null,
      checked_at: new Date().toISOString(),
    },
    last_sync_at: new Date(),
    sync_status: "SYNCED",
    raw_source_reference: `CJ:${input.pid}`,
  });
  for (let index = 0; index < input.variants.length; index += 1) {
    const source = input.variants[index];
    const target = product.variants[index];
    if (source && target)
      await domain.createSupplierVariantMaps({
        supplier_offer_id: offer.id,
        store_variant_id: target.id,
        supplier_sku: source.sku,
        supplier_variant_id: source.vid,
        attributes: {},
      });
  }
  await domain.createProductPolicies({
    product_id: product.id,
    fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
    sensitivity: "ORDINARY",
    compliance_status: "CLEAR",
    compliance_notes: "Importação CJ exige revisão humana do anúncio.",
    commercial_readiness: "PRICING_REQUIRED",
  });
  await recordAudit(domain, {
    action: "CJ_PRODUCT_IMPORTED_AS_DRAFT",
    entityType: "product",
    entityId: product.id,
    actorId: actorId(request),
    summary: "Produto CJ salvo como rascunho",
    metadata: { provider: "CJ", supplier_offer_id: offer.id },
  });
  response.status(201).json({
    product: { id: product.id, title: product.title, status: product.status },
    supplierOfferId: offer.id,
    isPrimary: true,
  });
}
