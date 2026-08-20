import { describe, expect, it } from "vitest";

describe("storefront baseline", () => {
  it("keeps external integration claims out of the bootstrap page", async () => {
    const source = (await import("./page")).default.toString();
    expect(source).toContain("storefront");
    expect(source).not.toContain("Alibaba conectado");
  });
});
