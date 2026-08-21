import { describe, expect, it } from "vitest";
import { productDeletionDecision } from "./product-lifecycle";

const safe = {
  status: "draft",
  offers: 0,
  orderLines: 0,
  cartLines: 0,
  shippingQuotes: 0,
  routingDecisions: 0,
};
describe("safe product deletion", () => {
  it("allows only an unlinked draft", () => {
    expect(productDeletionDecision(safe)).toEqual({
      allowed: true,
      reasons: [],
      archiveRecommended: false,
    });
  });
  it.each([
    [{ ...safe, status: "published" }, "publicado"],
    [{ ...safe, orderLines: 1 }, "pedido"],
    [{ ...safe, offers: 1 }, "fornecedor"],
    [{ ...safe, cartLines: 1 }, "carrinho"],
  ] as const)("blocks commercial history", (facts, reason) => {
    const result = productDeletionDecision(facts);
    expect(result.allowed).toBe(false);
    expect(result.archiveRecommended).toBe(true);
    expect(result.reasons.join(" ").toLowerCase()).toContain(reason);
  });
});
