import { describe, expect, it } from "vitest";

describe("storefront baseline", () => {
  it("keeps supplier details out of the customer-facing page", async () => {
    const source = (await import("./page")).default.toString();
    expect(source).toContain("demoProducts");
    expect(source).not.toContain("Alibaba conectado");
    expect(source).not.toContain("SupplierOffer");
    expect(source).not.toContain("MOQ");
  });
});
