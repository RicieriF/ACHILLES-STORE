import { describe, expect, it } from "vitest";
import { identifyAssistedSource } from "./source";

describe("assisted supplier source", () => {
  it("recognizes Alibaba and preserves a deterministic product id", () => {
    expect(
      identifyAssistedSource(
        "https://www.alibaba.com/product-detail/Test_1600123456789.html#details",
      ),
    ).toEqual({
      provider: "ALIBABA",
      canonicalUrl:
        "https://www.alibaba.com/product-detail/Test_1600123456789.html",
      externalProductId: "1600123456789",
    });
  });
  it("recognizes AliExpress without scraping", () => {
    expect(
      identifyAssistedSource(
        "https://pt.aliexpress.com/item/1005001234567890.html?src=achilles",
      ),
    ).toMatchObject({
      provider: "ALIEXPRESS",
      externalProductId: "1005001234567890",
    });
  });
  it("accepts another HTTPS supplier only as assisted origin", () => {
    expect(
      identifyAssistedSource("https://supplier.example/catalog/item-a"),
    ).toMatchObject({ provider: "OTHER", externalProductId: null });
  });
  it.each([
    "http://supplier.example/item",
    "https://localhost/item",
    "https://user:password@supplier.example/item",
  ])("blocks unsafe source %s", (source) => {
    expect(() => identifyAssistedSource(source)).toThrow();
  });
});
