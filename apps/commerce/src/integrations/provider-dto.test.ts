import { describe, expect, it } from "vitest";
import { normalizeAlibabaProduct, normalizeCJList } from "./provider-dto";

describe("provider DTOs", () => {
  const realCJListV2Shape = {
    code: 200,
    result: true,
    data: {
      pageSize: 20,
      pageNumber: 1,
      totalRecords: 24,
      totalPages: 2,
      content: [
        {
          productList: [
            {
              id: "DFCBD041-B1EA-411C-984C-556E9D24133B",
              nameEn: "Emergency flashlight",
              sku: "CJJZHWSD00064",
              bigImage: "https://cf.cjdropshipping.com/example.png",
              sellPrice: "4.49 -- 5.43",
              currency: null,
            },
            {
              id: "without-image-or-price",
              nameEn: "Flashlight without commercial data",
              sku: "CJ-MISSING",
              bigImage: null,
              sellPrice: null,
            },
          ],
        },
      ],
    },
  };

  it("maps the nested productList returned by CJ listV2 today", () => {
    expect(normalizeCJList(realCJListV2Shape)).toEqual({
      total: 24,
      items: [
        expect.objectContaining({
          id: "DFCBD041-B1EA-411C-984C-556E9D24133B",
          title: "Emergency flashlight",
          sku: "CJJZHWSD00064",
          image: "https://cf.cjdropshipping.com/example.png",
          priceMin: "4.49",
          priceMax: "5.43",
        }),
        expect.objectContaining({
          id: "without-image-or-price",
          image: null,
          priceMin: null,
          priceMax: null,
        }),
      ],
    });
  });

  it("normalizes an empty CJ page without inventing products", () => {
    expect(
      normalizeCJList({
        data: {
          pageSize: 20,
          pageNumber: 2,
          totalRecords: 0,
          totalPages: 0,
          content: [{ productList: [] }],
        },
      }),
    ).toEqual({ items: [], total: 0 });
  });

  it("maps CJ catalog data to visual cards", () => {
    expect(
      normalizeCJList({
        data: {
          total: 1,
          list: [
            {
              pid: "cj-1",
              productNameEn: "Lanterna",
              productSku: "SKU-1",
              sellPrice: "8.00",
            },
          ],
        },
      }),
    ).toMatchObject({
      total: 1,
      items: [{ id: "cj-1", title: "Lanterna", sku: "SKU-1" }],
    });
  });
  it("maps Alibaba official detail without exposing raw response", () => {
    const result = normalizeAlibabaProduct({
      alibaba_dropshipping_product_get_response: {
        value: {
          distribution_sale_product: [
            {
              product_id: 123456,
              name: "EDC pouch",
              supplier_name: "Factory Ltd",
              moq_and_price: {
                min_order_quantity: 2,
                moq_unit_price: { amount: "4.20", currency: "USD" },
              },
            },
          ],
        },
      },
    });
    expect(result).toMatchObject({
      id: "123456",
      title: "EDC pouch",
      supplier: "Factory Ltd",
      moq: 2,
    });
    expect(result).not.toHaveProperty(
      "alibaba_dropshipping_product_get_response",
    );
  });
});
