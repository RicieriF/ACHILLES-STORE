import type { MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { AdminRequest } from "../../http";

type ProductCategory = {
  id: string;
  name: string;
  handle: string;
  parent_category?: { id: string; name: string } | null;
};

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const query = request.scope.resolve<{
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: ProductCategory[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "parent_category.id",
      "parent_category.name",
    ],
    filters: { is_active: true },
  });
  const categories = [...data].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
  response.json({
    categories: categories.map((category: ProductCategory) => ({
      id: category.id,
      name: category.name,
      handle: category.handle,
      parent: category.parent_category
        ? {
            id: category.parent_category.id,
            name: category.parent_category.name,
          }
        : null,
    })),
  });
}
