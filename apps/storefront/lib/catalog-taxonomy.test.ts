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

  it("keeps empty categories out of public navigation", () => {
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
});
