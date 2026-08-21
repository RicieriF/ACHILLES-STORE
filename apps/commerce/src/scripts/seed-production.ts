import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows";

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

  logger.info(
    `Production structure ready: ${String(structuralCategories.length - missing.length)} existing, ${String(missing.length)} created; no products, orders, payments, or suppliers created.`,
  );
}
