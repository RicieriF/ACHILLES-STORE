import type { MedusaContainer } from "@medusajs/framework/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicCatalogService } from "../catalog/service";
import { PublicCartService, toPublicCart } from "./public-cart";

describe("public cart DTO", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the commerce-core line price and exposes no browser price input", () => {
    const cart = toPublicCart({
      id: "cart_1",
      subtotal: 298,
      items: [
        {
          id: "line_1",
          product_handle: "lanterna",
          product_title: "Lanterna",
          variant_title: "Padrão",
          variant_id: "variant_1",
          quantity: 2,
          unit_price: 149,
          total: 298,
        },
      ],
    });
    expect(cart.subtotal.amount).toBe(298);
    expect(cart.items[0]?.unitPrice.amount).toBe(149);
    expect(JSON.stringify(cart)).not.toContain("supplier");
  });

  it("does not add an unavailable public variant", async () => {
    vi.spyOn(
      PublicCatalogService.prototype,
      "getProductByVariantId",
    ).mockResolvedValue({
      id: "prod_1",
      slug: "lanterna",
      title: "Lanterna",
      description: "Descrição",
      shortDescription: "Descrição",
      categories: [],
      images: [],
      variants: [
        {
          id: "variant_1",
          title: "Padrão",
          options: [],
          available: false,
          price: { amount: 149, currencyCode: "brl", formatted: "R$ 149,00" },
        },
      ],
      price: { amount: 149, currencyCode: "brl", formatted: "R$ 149,00" },
      available: false,
      featured: false,
      newArrival: false,
      shippingOrigin: null,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    });
    const service = new PublicCartService({} as MedusaContainer);
    await expect(
      service.addItem("cart_1", "variant_1", 1),
    ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });
});
