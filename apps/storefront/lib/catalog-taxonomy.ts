import type { PublicCategoryDTO, PublicProductDTO } from "@achilles/domain";

export type CatalogTaxonomyItem = {
  handle: string;
  aliases: readonly string[];
  title: string;
  description: string;
  image: string;
  subcategories: readonly string[];
};

export const catalogTaxonomy: readonly CatalogTaxonomyItem[] = [
  {
    handle: "lanternas",
    aliases: ["iluminacao", "iluminação"],
    title: "Lanternas",
    description: "Iluminação portátil para rotina, trilha, camping e trabalho.",
    image: "/images/category-light.svg",
    subcategories: [
      "EDC",
      "Cabeça",
      "Camping",
      "Trabalho",
      "Alto alcance",
      "Acessórios",
    ],
  },
  {
    handle: "edc",
    aliases: ["everyday-carry-edc"],
    title: "Everyday Carry — EDC",
    description:
      "Equipamentos compactos e organização inteligente para o dia a dia.",
    image: "/images/category-field.svg",
    subcategories: [
      "Organizadores / Holders",
      "Lanternas EDC",
      "Ferramentas utilitárias",
      "Canetas",
      "Multitools",
      "Kits EDC",
    ],
  },
  {
    handle: "cutelaria",
    aliases: [],
    title: "Cutelaria",
    description:
      "Ferramentas utilitárias publicadas somente após revisão comercial e de compliance.",
    image: "/images/category-placeholder.svg",
    subcategories: [
      "Canivetes",
      "Facas Outdoor",
      "Facas Camping",
      "Facas para Pesca",
      "Facas Utilitárias",
      "Multitools",
      "Acessórios",
    ],
  },
  {
    handle: "camping-outdoor",
    aliases: ["camping", "outdoor-e-aventura"],
    title: "Camping & Outdoor",
    description:
      "Equipamentos essenciais para camping, trilha, pesca e atividades ao ar livre.",
    image: "/images/category-camp.svg",
    subcategories: [
      "Iluminação de camping",
      "Organização",
      "Emergência",
      "Acessórios",
      "Utilidades",
    ],
  },
] as const;

export function taxonomyItem(handle: string): CatalogTaxonomyItem | undefined {
  return catalogTaxonomy.find(
    (item) => item.handle === handle || item.aliases.includes(handle),
  );
}

export function canonicalCategoryHandle(handle: string): string {
  return taxonomyItem(handle)?.handle ?? handle;
}

export function presentCategory(
  category: PublicCategoryDTO,
): PublicCategoryDTO {
  const item = taxonomyItem(category.handle);
  if (!item) return category;
  return {
    ...category,
    handle: item.handle,
    title: item.title,
    description: item.description,
    image: category.image ?? {
      id: `taxonomy-${item.handle}`,
      url: item.image,
      alt: item.title,
    },
  };
}

export function presentProduct(product: PublicProductDTO): PublicProductDTO {
  return { ...product, categories: product.categories.map(presentCategory) };
}

export function publicMenuCategories(
  categories: readonly PublicCategoryDTO[],
): PublicCategoryDTO[] {
  const merged = new Map<string, PublicCategoryDTO>();
  for (const source of categories) {
    if (source.productCount < 1) continue;
    const category = presentCategory(source);
    const previous = merged.get(category.handle);
    merged.set(category.handle, {
      ...category,
      productCount: category.productCount + (previous?.productCount ?? 0),
    });
  }
  return catalogTaxonomy.flatMap((item) => {
    const category = merged.get(item.handle);
    return category ? [category] : [];
  });
}

export const simpleKitDefinitions = [
  "Kit EDC Essencial",
  "Kit EDC Trabalho",
  "Kit Motorista",
  "Kit Pesca",
  "Kit Outdoor",
] as const;
