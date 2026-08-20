import { describe, expect, it } from "vitest";
import { developmentCategories, developmentProducts } from "./seed-data";

describe("development seed", () => {
  it("contains the required Brazilian outdoor categories", () => {
    expect(developmentCategories).toEqual([
      "Iluminação",
      "Camping",
      "Pesca",
      "Mochilas e Bolsas",
      "Outdoor e Aventura",
    ]);
  });

  it("uses only clearly fictitious products, BRL integer prices, and no images", () => {
    expect(developmentProducts.length).toBeGreaterThan(0);
    for (const product of developmentProducts) {
      expect(product.title).toContain("[FICTÍCIO]");
      expect(product.description.toLowerCase()).toContain("fictício");
      expect(Number.isInteger(product.priceBrl)).toBe(true);
      expect(product).not.toHaveProperty("images");
    }
  });
});
