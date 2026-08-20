import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { describe, expect, it } from "vitest";
import { SUPPLIER_DOMAIN_MODULE } from "../modules/supplier-domain";
import { PublicCatalogService } from "./service";

const publicProduct = {
  id: "prod_public",
  status: "published",
  title: "Lanterna Pública",
  handle: "lanterna-publica",
  description: "Iluminação para camping",
  thumbnail: null,
  metadata: { supplierNote: "Alibaba private note" },
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
  images: [],
  categories: [
    {
      id: "cat_light",
      name: "Iluminação",
      handle: "iluminacao",
      is_active: true,
      is_internal: false,
    },
  ],
  options: [{ id: "opt_model", title: "Modelo" }],
  variants: [
    {
      id: "variant_public",
      title: "Padrão",
      manage_inventory: false,
      options: [{ option_id: "opt_model", value: "Padrão" }],
      price_set: { prices: [{ currency_code: "brl", amount: 149 }] },
    },
  ],
  sales_channels: [{ id: "sc_public" }],
};

const privateProduct = {
  ...publicProduct,
  id: "prod_private",
  status: "draft",
  title: "Produto Privado",
  handle: "produto-privado",
  variants: [{ ...publicProduct.variants[0], id: "variant_private" }],
};

function container(): MedusaContainer {
  const services = new Map<string, unknown>([
    [
      ContainerRegistrationKeys.QUERY,
      {
        graph: () => Promise.resolve({ data: [publicProduct, privateProduct] }),
      },
    ],
    [
      Modules.SALES_CHANNEL,
      { listSalesChannels: () => Promise.resolve([{ id: "sc_public" }]) },
    ],
    [
      SUPPLIER_DOMAIN_MODULE,
      {
        listProductPolicies: () =>
          Promise.resolve([
            {
              product_id: "prod_public",
              compliance_status: "CLEAR",
              commercial_readiness: "READY_FOR_REVIEW",
            },
            {
              product_id: "prod_private",
              compliance_status: "CLEAR",
              commercial_readiness: "READY_FOR_REVIEW",
            },
          ]),
        listSupplierOffers: () =>
          Promise.resolve([offer("prod_public"), offer("prod_private")]),
      },
    ],
  ]);
  return {
    resolve: (name: string) => services.get(name),
  } as unknown as MedusaContainer;
}

describe("PublicCatalogService", () => {
  it("publishes eligible products and derives only non-empty categories", async () => {
    const catalog = await new PublicCatalogService(container()).getCatalog();
    expect(catalog.products.map((product) => product.slug)).toEqual([
      "lanterna-publica",
    ]);
    expect(catalog.categories).toEqual([
      expect.objectContaining({ handle: "iluminacao", productCount: 1 }),
    ]);
  });

  it("does not search private or internal sourcing data", async () => {
    const service = new PublicCatalogService(container());
    expect(await service.search("privado")).toEqual([]);
    expect(await service.search("Alibaba")).toEqual([]);
    expect(await service.search("camping")).toHaveLength(1);
  });

  it("serializes an explicit DTO without sourcing fields", async () => {
    const catalog = await new PublicCatalogService(container()).getCatalog();
    const serialized = JSON.stringify(catalog);
    for (const forbidden of ["Supplier", "Alibaba", "MOQ", "CostQuote"])
      expect(serialized).not.toContain(forbidden);
  });
});

function offer(productId: string) {
  return {
    product_id: productId,
    status: "ACTIVE",
    is_primary: true,
    cost_quotes: [
      {
        status: "PRICED",
        approved_at: "2026-08-20T00:00:00.000Z",
        approved_by: "admin_1",
        approved_retail_price: "149.00",
        approved_snapshot_id: "snapshot_1",
      },
    ],
  };
}
