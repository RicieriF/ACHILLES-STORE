import type { MetadataRoute } from "next";
import { getPublicCatalog } from "../lib/commerce";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://achilles.example.invalid";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getPublicCatalog().catch(() => null);
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    ...(catalog?.categories.map((category) => ({
      url: `${siteUrl}/categoria/${category.handle}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })) ?? []),
    ...(catalog?.products.map((product) => ({
      url: `${siteUrl}/produto/${product.slug}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })) ?? []),
  ];
}
