import { describe, expect, it } from "vitest";
import {
  productImagePlaceholder,
  safeProductImageSource,
} from "./safe-product-image";

describe("safe product images", () => {
  it("accepts the explicit CJ image hosts and local assets", () => {
    expect(
      safeProductImageSource(
        "https://oss-cf.cjdropshipping.com/example/product.jpg",
      ),
    ).toBe("https://oss-cf.cjdropshipping.com/example/product.jpg");
    expect(
      safeProductImageSource("https://cf.cjdropshipping.com/example.png"),
    ).toBe("https://cf.cjdropshipping.com/example.png");
    expect(safeProductImageSource("/images/local.jpg")).toBe(
      "/images/local.jpg",
    );
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["malformed", "not a url"],
    ["protocol relative", "//oss-cf.cjdropshipping.com/image.jpg"],
    ["unapproved host", "https://example.com/image.jpg"],
    ["insecure CJ URL", "http://oss-cf.cjdropshipping.com/image.jpg"],
  ])("uses the Achilles placeholder for %s images", (_case, source) => {
    expect(safeProductImageSource(source)).toBe(productImagePlaceholder);
  });

  it("keeps a local placeholder available for load failures", async () => {
    const source = (
      await import("./safe-product-image")
    ).SafeProductImage.toString();
    expect(source).toContain("setFailedSource");
    expect(source).toContain("productImagePlaceholder");
    expect(source).toContain("onError");
  });
});
