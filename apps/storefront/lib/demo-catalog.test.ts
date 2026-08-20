import { describe, expect, it } from "vitest";
import { demoProducts } from "./demo-catalog";

describe("isolated visual catalog fixtures", () => {
  it("includes honest unavailable and unpublished demo states", () => {
    expect(demoProducts).toHaveLength(3);
    expect(demoProducts.map((product) => product.slug)).toEqual([
      "lanterna-trail-x1",
      "lampiao-camp-lumen",
      "organizador-field-kit",
    ]);

    const unavailable = demoProducts.find((product) => !product.available);
    expect(unavailable).toBeDefined();
    expect(unavailable?.price).toBeNull();
  });
});
