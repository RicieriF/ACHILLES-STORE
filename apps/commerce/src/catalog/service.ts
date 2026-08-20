import type {
  PublicCatalogDTO,
  PublicCategoryDTO,
  PublicImageDTO,
  PublicMoneyDTO,
  PublicProductDTO,
} from "@achilles/domain";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { brazilCommerceDefaults } from "@achilles/domain";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import { PublicCatalogPolicy } from "./public-catalog-policy";
import type { PublicCatalogDecision } from "./public-catalog-policy";

type InternalCategory = {
  id: string;
  name: string;
  handle: string;
  description?: string | null;
  is_active?: boolean;
  is_internal?: boolean;
};

type InternalVariant = {
  id: string;
  title: string;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  options?: Array<{ option_id: string; value: string }>;
  price_set?: {
    prices?: Array<{ currency_code: string; amount: number | string }>;
  };
};

type InternalProduct = {
  id: string;
  status: string;
  title: string;
  handle: string;
  description?: string | null;
  thumbnail?: string | null;
  images?: Array<{ id: string; url: string }>;
  categories?: InternalCategory[];
  variants?: InternalVariant[];
  options?: Array<{ id: string; title: string }>;
  sales_channels?: Array<{ id: string }>;
  metadata?: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type InternalPolicy = {
  product_id: string;
  compliance_status: string;
  commercial_readiness: string;
};

type InternalQuote = {
  status: string;
  approved_at: Date | string | null;
  approved_by: string | null;
  approved_retail_price: string | null;
  approved_snapshot_id: string | null;
};

type InternalOffer = {
  product_id: string;
  status: string;
  is_primary: boolean;
  fulfillment_mode?: string | null;
  cost_quotes?: InternalQuote[];
};

type CatalogQuery = {
  graph(input: {
    entity: string;
    fields: string[];
    pagination?: { take: number; order: Record<string, "ASC" | "DESC"> };
  }): Promise<{ data: InternalProduct[] }>;
};

type SalesChannelService = {
  listSalesChannels(filters: { name: string }): Promise<Array<{ id: string }>>;
};

type SupplierDomainReader = {
  listProductPolicies(filters: {
    product_id: string[];
  }): Promise<InternalPolicy[]>;
  listSupplierOffers(
    filters: { product_id: string[]; is_primary: boolean; status: string },
    config: { relations: ["cost_quotes"] },
  ): Promise<InternalOffer[]>;
};

export class PublicCatalogService {
  private readonly policy = new PublicCatalogPolicy();

  constructor(private readonly container: MedusaContainer) {}

  async getCatalog(): Promise<PublicCatalogDTO> {
    const products = await this.loadEligibleProducts();
    const categoryMap = new Map<string, PublicCategoryDTO>();

    for (const product of products) {
      for (const category of product.categories) {
        const existing = categoryMap.get(category.id);
        categoryMap.set(category.id, {
          ...category,
          productCount: (existing?.productCount ?? 0) + 1,
          image: existing?.image ?? product.images[0] ?? null,
        });
      }
    }

    const categories = [...categoryMap.values()].sort((left, right) =>
      left.title.localeCompare(right.title, "pt-BR"),
    );
    const counts = new Map(
      categories.map((category) => [category.id, category]),
    );
    return {
      products: products.map((product) => ({
        ...product,
        categories: product.categories.map(
          (category) => counts.get(category.id) ?? category,
        ),
      })),
      categories,
    };
  }

  async getProductByHandle(handle: string): Promise<PublicProductDTO | null> {
    const catalog = await this.getCatalog();
    return catalog.products.find((product) => product.slug === handle) ?? null;
  }

  async getProductByVariantId(
    variantId: string,
  ): Promise<PublicProductDTO | null> {
    const catalog = await this.getCatalog();
    return (
      catalog.products.find((product) =>
        product.variants.some((variant) => variant.id === variantId),
      ) ?? null
    );
  }

  async search(query: string): Promise<PublicProductDTO[]> {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    const { products } = await this.getCatalog();
    return products.filter((product) =>
      normalizeSearch(
        [
          product.title,
          product.shortDescription,
          ...product.categories.map((category) => category.title),
        ].join(" "),
      ).includes(normalized),
    );
  }

  async canPublishProduct(productId: string): Promise<PublicCatalogDecision> {
    const source = await this.loadSource();
    const product = source.products.find((item) => item.id === productId);
    if (!product) return { eligible: false, reasons: ["PRODUCT_NOT_FOUND"] };
    return this.evaluateProduct({ ...product, status: "published" }, source);
  }

  private async loadEligibleProducts(): Promise<PublicProductDTO[]> {
    const source = await this.loadSource();
    if (!source.publicChannelId) return [];
    return source.products.flatMap((product) => {
      const decision = this.evaluateProduct(product, source);
      return decision.eligible
        ? [
            toPublicProduct(
              product,
              decision.approvedPrice,
              source.offerByProduct.get(product.id),
            ),
          ]
        : [];
    });
  }

  private evaluateProduct(
    product: InternalProduct,
    source: CatalogSource,
  ): PublicCatalogDecision {
    if (!source.publicChannelId)
      return { eligible: false, reasons: ["PUBLIC_SALES_CHANNEL_MISSING"] };
    const policy = source.policyByProduct.get(product.id);
    const offer = source.offerByProduct.get(product.id);
    const quote = offer?.cost_quotes?.[0];
    return this.policy.evaluate({
      product: {
        status: product.status,
        title: product.title,
        handle: product.handle,
        description: product.description ?? null,
        salesChannelIds:
          product.sales_channels?.map((channel) => channel.id) ?? [],
        variantIds: product.variants?.map((variant) => variant.id) ?? [],
        variantPrices:
          product.variants?.flatMap((variant) => {
            const price = variant.price_set?.prices?.find(
              (item) => item.currency_code.toLowerCase() === "brl",
            );
            const amount = Number(price?.amount);
            return Number.isFinite(amount) ? [amount] : [];
          }) ?? [],
        categoryIds: publicCategories(product).map((category) => category.id),
        blocked: product.metadata?.achilles_blocked === true,
      },
      policy: policy
        ? {
            complianceStatus: policy.compliance_status,
            commercialReadiness: policy.commercial_readiness,
          }
        : null,
      offer: offer ? { status: offer.status, primary: offer.is_primary } : null,
      price: quote
        ? {
            status: quote.status,
            approvedAt: quote.approved_at,
            approvedBy: quote.approved_by,
            approvedRetailPrice: quote.approved_retail_price,
            approvedSnapshotId: quote.approved_snapshot_id,
          }
        : null,
      publicSalesChannelId: source.publicChannelId,
    });
  }

  private async loadSource(): Promise<CatalogSource> {
    const query = this.container.resolve<CatalogQuery>(
      ContainerRegistrationKeys.QUERY,
    );
    const salesChannels = this.container.resolve<SalesChannelService>(
      Modules.SALES_CHANNEL,
    );
    const supplierDomain = this.container.resolve<SupplierDomainReader>(
      SUPPLIER_DOMAIN_MODULE,
    );
    const [publicChannel] = await salesChannels.listSalesChannels({
      name: brazilCommerceDefaults.salesChannelName,
    });

    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "status",
        "title",
        "handle",
        "description",
        "thumbnail",
        "metadata",
        "created_at",
        "updated_at",
        "images.id",
        "images.url",
        "categories.id",
        "categories.name",
        "categories.handle",
        "categories.description",
        "categories.is_active",
        "categories.is_internal",
        "options.id",
        "options.title",
        "variants.id",
        "variants.title",
        "variants.manage_inventory",
        "variants.allow_backorder",
        "variants.options.option_id",
        "variants.options.value",
        "variants.price_set.prices.currency_code",
        "variants.price_set.prices.amount",
        "sales_channels.id",
      ],
      pagination: { take: 500, order: { created_at: "DESC" } },
    });
    if (products.length === 0)
      return {
        products: [],
        publicChannelId: publicChannel?.id ?? null,
        policyByProduct: new Map(),
        offerByProduct: new Map(),
      };
    const ids = products.map((product) => product.id);
    const [policies, offers] = await Promise.all([
      supplierDomain.listProductPolicies({ product_id: ids }),
      supplierDomain.listSupplierOffers(
        { product_id: ids, is_primary: true, status: "ACTIVE" },
        { relations: ["cost_quotes"] },
      ),
    ]);
    const policyByProduct = new Map(
      policies.map((item) => [item.product_id, item]),
    );
    const offerByProduct = new Map(
      offers.map((item) => [item.product_id, item]),
    );

    return {
      products,
      publicChannelId: publicChannel?.id ?? null,
      policyByProduct,
      offerByProduct,
    };
  }
}

type CatalogSource = {
  products: InternalProduct[];
  publicChannelId: string | null;
  policyByProduct: Map<string, InternalPolicy>;
  offerByProduct: Map<string, InternalOffer>;
};

function toPublicProduct(
  product: InternalProduct,
  approvedPrice: number,
  offer?: InternalOffer,
): PublicProductDTO {
  const price = money(approvedPrice);
  const categories = publicCategories(product).map((category) => ({
    id: category.id,
    handle: category.handle,
    title: category.name,
    description: category.description?.trim() || null,
    productCount: 0,
    image: null,
  }));
  const optionNames = new Map(
    product.options?.map((option) => [option.id, option.title]) ?? [],
  );
  const images = publicImages(product);
  const createdAt = new Date(product.created_at).toISOString();
  return {
    id: product.id,
    slug: product.handle,
    title: product.title,
    description: product.description?.trim() ?? "",
    shortDescription: shortDescription(product.description ?? ""),
    categories,
    images,
    variants:
      product.variants?.map((variant) => ({
        id: variant.id,
        title: variant.title,
        options:
          variant.options?.map((option) => ({
            name: optionNames.get(option.option_id) ?? "Opção",
            value: option.value,
          })) ?? [],
        available:
          variant.allow_backorder === true ||
          variant.manage_inventory === false,
        price,
      })) ?? [],
    price,
    available:
      product.variants?.some(
        (variant) =>
          variant.allow_backorder === true ||
          variant.manage_inventory === false,
      ) ?? false,
    featured: product.metadata?.achilles_featured === true,
    newArrival:
      product.metadata?.achilles_new_arrival === true ||
      Date.now() - new Date(createdAt).getTime() < 1000 * 60 * 60 * 24 * 45,
    shippingOrigin:
      offer?.fulfillment_mode === "BRAZIL_STOCK"
        ? "BRAZIL"
        : offer?.fulfillment_mode
          ? "INTERNATIONAL"
          : null,
    createdAt,
    updatedAt: new Date(product.updated_at).toISOString(),
  };
}

function publicCategories(product: InternalProduct): InternalCategory[] {
  return (product.categories ?? []).filter(
    (category) =>
      category.is_active !== false &&
      category.is_internal !== true &&
      Boolean(category.handle.trim()),
  );
}

function publicImages(product: InternalProduct): PublicImageDTO[] {
  const candidates = [
    ...(product.thumbnail
      ? [{ id: `${product.id}-thumbnail`, url: product.thumbnail }]
      : []),
    ...(product.images ?? []),
  ];
  const unique = new Map<string, PublicImageDTO>();
  for (const image of candidates) {
    const url = safeImageUrl(image.url);
    if (url && !unique.has(url))
      unique.set(url, { id: image.id, url, alt: product.title });
  }
  return [...unique.values()];
}

function safeImageUrl(value: string): string | null {
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    const blockedHosts = ["alibaba", "alicdn", "aliexpress"];
    return url.protocol === "https:" &&
      !blockedHosts.some((host) => url.hostname.includes(host))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function money(amount: number): PublicMoneyDTO {
  return {
    amount,
    currencyCode: "brl",
    formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount),
  };
}

function shortDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 150 ? `${normalized.slice(0, 147)}…` : normalized;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
