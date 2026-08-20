import type {
  PublicCartDTO,
  PublicCatalogDTO,
  PublicProductDTO,
  PublicShippingQuoteDTO,
} from "@achilles/domain";
import {
  canonicalCategoryHandle,
  presentProduct,
  publicMenuCategories,
} from "./catalog-taxonomy";

const commerceUrl = (
  process.env.NEXT_PUBLIC_COMMERCE_URL ?? "http://localhost:9000"
).replace(/\/$/, "");

export class StorefrontDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontDataError";
  }
}

export async function getPublicCatalog(input?: {
  query?: string;
  category?: string;
}): Promise<PublicCatalogDTO> {
  const parameters = new URLSearchParams();
  if (input?.query) parameters.set("q", input.query);
  const catalog = await commerceFetch<PublicCatalogDTO>(
    `/achilles/store/catalog${parameters.size ? `?${parameters}` : ""}`,
  );
  const products = catalog.products.map(presentProduct);
  const category = input?.category
    ? canonicalCategoryHandle(input.category)
    : null;
  return {
    categories: publicMenuCategories(catalog.categories),
    products: category
      ? products.filter((product) =>
          product.categories.some((item) => item.handle === category),
        )
      : products,
  };
}

export async function getPublicProduct(
  handle: string,
): Promise<PublicProductDTO | null> {
  const response = await fetch(
    `${commerceUrl}/achilles/store/products/${encodeURIComponent(handle)}`,
    { cache: "no-store", signal: AbortSignal.timeout(8_000) },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new StorefrontDataError("Não foi possível carregar o produto");
  const payload: unknown = await response.json();
  if (!isObject(payload) || !isPublicProduct(payload.product))
    throw new StorefrontDataError("Resposta pública de produto inválida");
  return presentProduct(payload.product);
}

export async function commerceCartRequest(
  path: string,
  init: RequestInit,
): Promise<PublicCartDTO> {
  const response = await fetch(`${commerceUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(8_000),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      isObject(payload) && typeof payload.message === "string"
        ? payload.message
        : "Não foi possível atualizar o carrinho";
    throw new StorefrontDataError(message);
  }
  if (!isObject(payload) || !isPublicCart(payload.cart))
    throw new StorefrontDataError("Resposta pública de carrinho inválida");
  return payload.cart;
}

export async function commerceShippingRequest(
  body: unknown,
): Promise<PublicShippingQuoteDTO> {
  const response = await fetch(`${commerceUrl}/achilles/store/shipping/quote`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      isObject(payload) && typeof payload.message === "string"
        ? payload.message
        : "Não foi possível calcular a entrega";
    throw new StorefrontDataError(message);
  }
  if (!isObject(payload) || !isPublicShippingQuote(payload.quote))
    throw new StorefrontDataError("Resposta pública de frete inválida");
  return payload.quote;
}

async function commerceFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${commerceUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok)
    throw new StorefrontDataError("Catálogo temporariamente indisponível");
  const payload: unknown = await response.json();
  if (
    !isObject(payload) ||
    !Array.isArray(payload.products) ||
    !payload.products.every(isPublicProduct) ||
    !Array.isArray(payload.categories)
  )
    throw new StorefrontDataError("Resposta pública de catálogo inválida");
  return payload as T;
}

function isPublicProduct(value: unknown): value is PublicProductDTO {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.categories) &&
    Array.isArray(value.images) &&
    Array.isArray(value.variants) &&
    isObject(value.price) &&
    typeof value.price.amount === "number"
  );
}

function isPublicCart(value: unknown): value is PublicCartDTO {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.items) &&
    typeof value.itemCount === "number" &&
    isObject(value.subtotal) &&
    typeof value.subtotal.formatted === "string"
  );
}

function isPublicShippingQuote(
  value: unknown,
): value is PublicShippingQuoteDTO {
  return (
    isObject(value) &&
    typeof value.destinationPostalCode === "string" &&
    ["SINGLE", "MULTI_SHIPMENT"].includes(String(value.shipmentType)) &&
    Array.isArray(value.methods) &&
    value.methods.every(
      (method) =>
        isObject(method) &&
        typeof method.id === "string" &&
        typeof method.name === "string" &&
        isObject(method.price) &&
        typeof method.price.formatted === "string" &&
        typeof method.estimatedMinimumDays === "number" &&
        typeof method.estimatedMaximumDays === "number",
    )
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
