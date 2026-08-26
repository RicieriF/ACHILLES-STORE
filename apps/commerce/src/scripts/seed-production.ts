import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows";

const structuralCategories = [
  { name: "Lanternas", handle: "lanternas" },
  { name: "Everyday Carry — EDC", handle: "edc" },
  { name: "Cutelaria", handle: "cutelaria" },
  { name: "Camping & Outdoor", handle: "camping-outdoor" },
] as const;

type CatalogQuery = {
  graph(input: {
    entity: string;
    fields: string[];
    filters: Record<string, unknown>;
  }): Promise<{ data: Array<{ handle: string }> }>;
};

export default async function seedProductionStructure({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<CatalogQuery>(
    ContainerRegistrationKeys.QUERY,
  );
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["handle"],
    filters: { handle: structuralCategories.map(({ handle }) => handle) },
  });
  const handles = new Set(existing.map(({ handle }) => handle));
  const missing = structuralCategories.filter(
    ({ handle }) => !handles.has(handle),
  );

  if (missing.length > 0) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missing.map(({ name, handle }) => ({
          name,
          handle,
          is_active: true,
          metadata: { achilles_structural: true },
        })),
      },
    });
  }

  const [shippingProfile] = await fulfillment.listShippingProfiles({
    type: "default",
  });
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Perfil de entrega padrão", type: "default" }],
      },
    });
    if (!result[0])
      throw new Error("Could not create a default shipping profile");
  }

  logger.info(
    `Production structure ready: ${String(structuralCategories.length - missing.length)} categories existing, ${String(missing.length)} created; shipping profile ${shippingProfile ? "existing" : "created"}; no products, orders, payments, or suppliers created.`,
  );
}
