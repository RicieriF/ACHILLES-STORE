import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  updateProductVariantsWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  brazilCommerceDefaults,
  primaryFulfillmentMode,
} from "@achilles/domain";
import { developmentCategories, developmentProducts } from "./seed-data";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import type SupplierDomainModuleService from "../modules/supplier-domain/service";

type CatalogQuery = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }): Promise<{ data: Array<{ id: string; handle: string }> }>;
};

const updateStoreCurrencies = createWorkflow(
  "achilles-update-store-currencies",
  (input: {
    storeId: string;
    currencies: Array<{ currency_code: string; is_default: boolean }>;
  }) => {
    const normalizedInput = transform({ input }, ({ input: data }) => ({
      selector: { id: data.storeId },
      update: { supported_currencies: data.currencies },
    }));
    return new WorkflowResponse(updateStoresStep(normalizedInput));
  },
);

export default async function seedDevelopmentData({ container }: ExecArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed cannot run in production");
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storeService = container.resolve(Modules.STORE);
  const regionService = container.resolve(Modules.REGION);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const productService = container.resolve(Modules.PRODUCT);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);
  const query = container.resolve<CatalogQuery>(
    ContainerRegistrationKeys.QUERY,
  );

  logger.info("Seeding Achilles Store development commerce data...");

  const [store] = await storeService.listStores();
  if (!store) {
    throw new Error("Medusa store was not created by the official migrations");
  }

  let [salesChannel] = await salesChannelService.listSalesChannels({
    name: brazilCommerceDefaults.salesChannelName,
  });
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          { name: brazilCommerceDefaults.salesChannelName, is_disabled: false },
        ],
      },
    });
    salesChannel = result[0];
  }

  if (!salesChannel) {
    throw new Error("Could not create the main Brazil sales channel");
  }

  await updateStoreCurrencies(container).run({
    input: {
      storeId: store.id,
      currencies: [
        {
          currency_code: brazilCommerceDefaults.currencyCode,
          is_default: true,
        },
      ],
    },
  });
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: salesChannel.id },
    },
  });

  const regions = await regionService.listRegions({
    name: brazilCommerceDefaults.regionName,
  });
  if (regions.length === 0) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: brazilCommerceDefaults.regionName,
            currency_code: brazilCommerceDefaults.currencyCode,
            countries: [brazilCommerceDefaults.countryCode],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
  }

  const categoryHandle = (name: string) =>
    name.toLocaleLowerCase("pt-BR").replaceAll(" ", "-");
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: developmentCategories.map(categoryHandle) },
  });
  const categoryByHandle = new Map(
    existingCategories.map((category) => [category.handle, category]),
  );
  const missingCategoryNames = developmentCategories.filter(
    (name) => !categoryByHandle.has(categoryHandle(name)),
  );
  if (missingCategoryNames.length > 0) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingCategoryNames.map((name) => ({
          name,
          handle: categoryHandle(name),
          is_active: true,
        })),
      },
    });
    for (const category of result) {
      categoryByHandle.set(category.handle, category);
    }
  }

  let [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  });
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Perfil de entrega padrão", type: "default" }],
      },
    });
    shippingProfile = result[0];
  }

  if (!shippingProfile) {
    throw new Error("Could not create a default shipping profile");
  }

  const existingProducts = await productService.listProducts({
    handle: developmentProducts.map((product) => product.handle),
  });
  const existingHandles = new Set(
    existingProducts.map((product) => product.handle),
  );
  const productsToCreate = developmentProducts.filter(
    (product) => !existingHandles.has(product.handle),
  );

  if (productsToCreate.length > 0) {
    await createProductsWorkflow(container).run({
      input: {
        products: productsToCreate.map((product) => {
          const category = categoryByHandle.get(
            categoryHandle(product.category),
          );
          if (!category) {
            throw new Error(`Missing seed category: ${product.category}`);
          }

          return {
            title: product.title,
            handle: product.handle,
            description: product.description,
            status: ProductStatus.PUBLISHED,
            category_ids: [category.id],
            shipping_profile_id: shippingProfile.id,
            sales_channels: [{ id: salesChannel.id }],
            metadata: {
              seed: "TASK_002_DEVELOPMENT_ONLY",
              fulfillment_mode: primaryFulfillmentMode,
            },
            options: [{ title: "Modelo", values: ["Padrão"] }],
            variants: [
              {
                title: "Padrão",
                sku: product.sku,
                manage_inventory: false,
                options: { Modelo: "Padrão" },
                prices: [
                  {
                    currency_code: brazilCommerceDefaults.currencyCode,
                    amount: product.priceBrl,
                  },
                ],
              },
            ],
          };
        }),
      },
    });
  }

  const supplierDomain = container.resolve<SupplierDomainModuleService>(
    SUPPLIER_DOMAIN_MODULE,
  );
  const seededProducts = await productService.listProducts({
    handle: developmentProducts.map((product) => product.handle),
  });
  const [manualSupplier] = await supplierDomain.listSuppliers({
    name: "[FICTÍCIO] Fábrica Outdoor Manual",
  });
  const supplier =
    manualSupplier ??
    (await supplierDomain.createSuppliers({
      name: "[FICTÍCIO] Fábrica Outdoor Manual",
      provider: "MANUAL",
      status: "ACTIVE",
      country_code: "CN",
      contact_name: "Contato de desenvolvimento",
      contact_email: "dev-supplier@example.invalid",
      notes: "Fornecedor fictício criado pela TASK 003.",
      metadata: { seed: "TASK_003_DEVELOPMENT_ONLY" },
    }));
  const alternate =
    (
      await supplierDomain.listSuppliers({
        name: "[FICTÍCIO] Fornecedor Alternativo",
      })
    )[0] ??
    (await supplierDomain.createSuppliers({
      name: "[FICTÍCIO] Fornecedor Alternativo",
      provider: "OTHER",
      status: "ACTIVE",
      country_code: "CN",
      notes: "Alternativa fictícia para demonstrar múltiplas ofertas.",
      metadata: { seed: "TASK_003_DEVELOPMENT_ONLY" },
    }));
  const branding =
    (
      await supplierDomain.listBrandingProfiles({ name: "Perfil Achilles Dev" })
    )[0] ??
    (await supplierDomain.createBrandingProfiles({
      supplier_id: supplier.id,
      name: "Perfil Achilles Dev",
      brand_name: "[FICTÍCIO] Achilles Outdoor",
      language: "pt-BR",
      packaging_instructions:
        "Embalagem neutra com referência de marca fictícia.",
      insert_instructions: "Manual em português para demonstração.",
      branding_moq: 20,
      setup_cost: "45.00",
      per_unit_branding_cost: "1.25",
      currency: "USD",
      lead_time_days: 12,
    }));

  const mainProduct = seededProducts.find(
    (product) => product.handle === developmentProducts[0].handle,
  );
  if (mainProduct) {
    const existingOffers = await supplierDomain.listSupplierOffers({
      product_id: mainProduct.id,
    });
    if (existingOffers.length === 0) {
      await supplierDomain.createSupplierOffers([
        {
          supplier_id: supplier.id,
          branding_profile_id: branding.id,
          product_id: mainProduct.id,
          supplier_product_id: "DEV-LANTERNA-PRIMARY-001",
          source_url: "https://example.invalid/dev-primary-001",
          currency: "USD",
          unit_cost: "8.50",
          moq: 1,
          availability: "IN_STOCK",
          status: "ACTIVE",
          fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
          private_label_supported: true,
          branding_moq: 20,
          branding_lead_time_days: 12,
          is_primary: true,
          sync_status: "NEVER_SYNCED",
          notes: "Oferta fictícia principal.",
        },
        {
          supplier_id: alternate.id,
          product_id: mainProduct.id,
          supplier_product_id: "DEV-LANTERNA-ALT-001",
          source_url: "https://example.invalid/dev-alternate-001",
          currency: "USD",
          unit_cost: "9.10",
          moq: 1,
          availability: "UNKNOWN",
          status: "ACTIVE",
          fulfillment_mode: "GENERIC_DROPSHIP",
          private_label_supported: false,
          is_primary: false,
          sync_status: "NEVER_SYNCED",
          notes: "Oferta fictícia alternativa.",
        },
      ]);
    }
  }

  for (const product of seededProducts) {
    const publicDevelopmentProduct =
      product.handle === developmentProducts[0].handle;
    const existingPolicy = await supplierDomain.listProductPolicies({
      product_id: product.id,
    });
    const currentPolicy = existingPolicy[0];
    if (!currentPolicy) {
      await supplierDomain.createProductPolicies({
        product_id: product.id,
        fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
        compliance_status: publicDevelopmentProduct
          ? "CLEAR"
          : "REVIEW_REQUIRED",
        sensitivity: "ORDINARY",
        commercial_readiness: publicDevelopmentProduct
          ? "READY_FOR_REVIEW"
          : "COMPLIANCE_REQUIRED",
        compliance_notes: publicDevelopmentProduct
          ? "Produto fictício liberado somente no ambiente de desenvolvimento."
          : "Exemplo fictício encaminhado para revisão administrativa.",
        reviewed_by: publicDevelopmentProduct ? "development-seed" : null,
        reviewed_at: publicDevelopmentProduct ? new Date() : null,
      });
    } else if (publicDevelopmentProduct) {
      await supplierDomain.updateProductPolicies({
        id: currentPolicy.id,
        compliance_status: "CLEAR",
        commercial_readiness: "READY_FOR_REVIEW",
        reviewed_by: "development-seed",
        reviewed_at: new Date(),
        compliance_notes:
          "Produto fictício liberado somente no ambiente de desenvolvimento.",
      });
    } else {
      await supplierDomain.updateProductPolicies({
        id: currentPolicy.id,
        compliance_status: "REVIEW_REQUIRED",
        commercial_readiness: "COMPLIANCE_REQUIRED",
        reviewed_by: null,
        reviewed_at: null,
        compliance_notes:
          "Exemplo fictício encaminhado para revisão administrativa.",
      });
    }
  }

  if (mainProduct) {
    const productWithVariants = await productService.retrieveProduct(
      mainProduct.id,
      { relations: ["variants"] },
    );
    for (const variant of productWithVariants.variants) {
      if (variant.manage_inventory)
        await updateProductVariantsWorkflow(container).run({
          input: {
            selector: { id: variant.id, product_id: mainProduct.id },
            update: { manage_inventory: false },
          },
        });
    }

    const productOffers = await supplierDomain.listSupplierOffers({
      product_id: mainProduct.id,
    });
    const primaryOffer = productOffers.find((offer) => offer.is_primary);
    const alternateOffer = productOffers.find((offer) => !offer.is_primary);
    const primaryShippingFixture = {
      source: "TASK_009_DEVELOPMENT_FIXTURE",
      shipping_methods: [
        {
          service_code: "MANUAL_ECONOMY",
          method_name: "Entrega Econômica",
          currency: "USD",
          amount: "31.00",
          estimated_min_days: 15,
          estimated_max_days: 25,
          tracking_supported: true,
          duties_mode: "UNKNOWN",
          warnings: [
            "Cotação fictícia exclusiva do ambiente de desenvolvimento",
          ],
          assumptions: [
            "Tabela manual fictícia, sem chamada ao Alibaba ou outro provider",
          ],
          ttl_seconds: 300,
        },
        {
          service_code: "MANUAL_EXPRESS",
          method_name: "Entrega Expressa",
          currency: "USD",
          amount: "45.00",
          estimated_min_days: 7,
          estimated_max_days: 12,
          tracking_supported: true,
          duties_mode: "DDP",
          warnings: [
            "Cotação fictícia exclusiva do ambiente de desenvolvimento",
          ],
          assumptions: [
            "DDP declarado explicitamente pela fixture manual; não representa operação real",
          ],
          ttl_seconds: 300,
        },
      ],
    };
    const alternateShippingFixture = {
      source: "TASK_009_DEVELOPMENT_FIXTURE",
      shipping_methods: [
        {
          service_code: "MANUAL_ALT_ECONOMY",
          method_name: "Entrega Econômica Alternativa",
          currency: "USD",
          amount: "14.00",
          estimated_min_days: 18,
          estimated_max_days: 28,
          tracking_supported: true,
          duties_mode: "DAP",
          warnings: ["Fornecedor sem private label"],
          assumptions: [
            "Tabela manual fictícia, sem chamada a provider externo",
          ],
          ttl_seconds: 300,
        },
      ],
    };
    if (primaryOffer)
      await supplierDomain.updateSupplierOffers({
        id: primaryOffer.id,
        freight_metadata: primaryShippingFixture,
      });
    if (alternateOffer)
      await supplierDomain.updateSupplierOffers({
        id: alternateOffer.id,
        freight_metadata: alternateShippingFixture,
      });
    for (const offer of productOffers) {
      const maps = await supplierDomain.listSupplierVariantMaps({
        supplier_offer_id: offer.id,
      });
      for (const variant of productWithVariants.variants) {
        if (!maps.some((map) => map.store_variant_id === variant.id))
          await supplierDomain.createSupplierVariantMaps({
            supplier_offer_id: offer.id,
            store_variant_id: variant.id,
            supplier_sku: `${offer.supplier_product_id}-${variant.id}`,
            supplier_variant_id: null,
            attributes: { source: "TASK_009_DEVELOPMENT_FIXTURE" },
          });
      }
    }
    if (primaryOffer) {
      const [existingQuote] = await supplierDomain.listCostQuotes({
        supplier_offer_id: primaryOffer.id,
      });
      if (!existingQuote) {
        const approvedAt = new Date();
        const quote = await supplierDomain.createCostQuotes({
          supplier_offer_id: primaryOffer.id,
          status: "PRICED",
          source_currency: "USD",
          supplier_unit_cost: "8.50",
          moq: 1,
          suggested_retail_price: "149.00",
          approved_retail_price: "149.00",
          approved_at: approvedAt,
          approved_by: "development-seed",
          fx_rate: "5.00",
          fx_source: "TASK_009_DEVELOPMENT_FIXTURE",
          fx_captured_at: approvedAt,
          assumptions: {
            items: ["Fixture comercial local; não utilizar em produção"],
          },
          warnings: { items: [] },
          calculated_at: approvedAt,
        });
        const snapshot = await supplierDomain.createPricingSnapshots({
          cost_quote_id: quote.id,
          version: 1,
          engine_version: "task-008-development-seed",
          inputs: { source: "development-seed" },
          outputs: { suggestedRetailPrice: "149.00" },
          assumptions: {
            items: ["Fixture comercial local; não utilizar em produção"],
          },
          warnings: { items: [] },
          fx_rate: "1.00",
          fx_source: "development-seed",
          fx_timestamp: approvedAt,
          customs_strategy: "MANUAL_QUOTE",
          calculated_by: "development-seed",
          calculated_at: approvedAt,
          approved_by: "development-seed",
          approved_at: approvedAt,
          approved_retail_price: "149.00",
        });
        await supplierDomain.updateCostQuotes({
          id: quote.id,
          approved_snapshot_id: snapshot.id,
        });
      } else {
        await supplierDomain.updateCostQuotes({
          id: existingQuote.id,
          fx_rate: "5.00",
          fx_source: "TASK_009_DEVELOPMENT_FIXTURE",
          fx_captured_at: new Date(),
        });
      }
    }
    if (alternateOffer) {
      const [alternateQuote] = await supplierDomain.listCostQuotes({
        supplier_offer_id: alternateOffer.id,
      });
      if (!alternateQuote)
        await supplierDomain.createCostQuotes({
          supplier_offer_id: alternateOffer.id,
          status: "INCOMPLETE",
          source_currency: "USD",
          supplier_unit_cost: alternateOffer.unit_cost,
          moq: alternateOffer.moq,
          fx_rate: "5.00",
          fx_source: "TASK_009_DEVELOPMENT_FIXTURE",
          fx_captured_at: new Date(),
          assumptions: {
            items: ["FX fictício exclusivo do simulador logístico local"],
          },
          warnings: { items: [] },
        });
    }
  }

  logger.info("Achilles Store development seed completed.");
}
