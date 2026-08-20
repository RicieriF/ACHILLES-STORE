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

  const existingCategories = await productService.listProductCategories({});
  const categoryByName = new Map(
    existingCategories.map((category) => [category.name, category]),
  );
  const missingCategoryNames = developmentCategories.filter(
    (name) => !categoryByName.has(name),
  );
  if (missingCategoryNames.length > 0) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingCategoryNames.map((name) => ({
          name,
          is_active: true,
        })),
      },
    });
    for (const category of result) {
      categoryByName.set(category.name, category);
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
          const category = categoryByName.get(product.category);
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
                manage_inventory: true,
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

  logger.info("Achilles Store development seed completed.");
}
