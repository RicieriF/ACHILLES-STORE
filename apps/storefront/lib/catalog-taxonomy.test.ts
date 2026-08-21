import { describe, expect, it } from "vitest";
import {
  canonicalCategoryHandle,
  publicMenuCategories,
  taxonomyItem,
} from "./catalog-taxonomy";

describe("catalog taxonomy", () => {
  it("renames the legacy lighting category", () => {
    expect(canonicalCategoryHandle("iluminacao")).toBe("lanternas");
    expect(canonicalCategoryHandle("iluminação")).toBe("lanternas");
    expect(taxonomyItem("lanternas")?.title).toBe("Lanternas");
  });

  it("keeps empty categories out of production navigation", () => {
    const result = publicMenuCategories([
      {
        id: "1",
        handle: "iluminacao",
        title: "Iluminação",
        description: null,
        productCount: 1,
        image: null,
      },
      {
        id: "2",
        handle: "cutelaria",
        title: "Cutelaria",
        description: null,
        productCount: 0,
        image: null,
      },
    ]);
    expect(result.map((category) => category.title)).toEqual(["Lanternas"]);
  });

  it("includes all structural categories outside production without products", () => {
    const result = publicMenuCategories([], { includeEmptyStructural: true });
    expect(
      result.map((category) => [category.handle, category.productCount]),
    ).toEqual([
      ["lanternas", 0],
      ["edc", 0],
      ["cutelaria", 0],
      ["camping-outdoor", 0],
    ]);
  });
});
