export type PublicMoneyDTO = {
  amount: number;
  currencyCode: "brl";
  formatted: string;
};

export type PublicImageDTO = {
  id: string;
  url: string;
  alt: string;
};

export type PublicVariantDTO = {
  id: string;
  title: string;
  options: Array<{ name: string; value: string }>;
  available: boolean;
  price: PublicMoneyDTO;
};

export type PublicCategoryDTO = {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  productCount: number;
  image: PublicImageDTO | null;
};

export type PublicProductDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  categories: PublicCategoryDTO[];
  images: PublicImageDTO[];
  variants: PublicVariantDTO[];
  price: PublicMoneyDTO;
  available: boolean;
  featured: boolean;
  newArrival: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicCatalogDTO = {
  products: PublicProductDTO[];
  categories: PublicCategoryDTO[];
};

export type PublicCartItemDTO = {
  id: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  variantId: string;
  thumbnail: string | null;
  quantity: number;
  unitPrice: PublicMoneyDTO;
  total: PublicMoneyDTO;
};

export type PublicCartDTO = {
  id: string;
  items: PublicCartItemDTO[];
  itemCount: number;
  subtotal: PublicMoneyDTO;
};
