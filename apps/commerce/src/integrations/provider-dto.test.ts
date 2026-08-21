import { describe, expect, it } from "vitest";
import { normalizeAlibabaProduct, normalizeCJList } from "./provider-dto";

describe("provider DTOs", () => {
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
