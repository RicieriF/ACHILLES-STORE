import { describe, expect, it } from "vitest";

describe("storefront baseline", () => {
  it("loads only the public catalog adapter", async () => {
    const source = (await import("./page")).default.toString();
    expect(source).toContain("getPublicCatalog");
    expect(source).not.toContain("demoProducts");
    expect(source).not.toContain("Alibaba conectado");
    expect(source).not.toContain("SupplierOffer");
    expect(source).not.toContain("MOQ");
  });

  it("distinguishes catalog failure from an empty successful catalog", async () => {
    const source = (await import("./page")).default.toString();
    expect(source).toContain(
      "Não foi possível carregar os produtos. Tente novamente.",
    );
    expect(source).toContain("Ainda não há produtos disponíveis.");
    expect(source).not.toContain("O catálogo não respondeu");
  });
});
