import { describe, expect, it } from "vitest";
import { PublicCatalogPolicy } from "./public-catalog-policy";

const policy = new PublicCatalogPolicy();
const eligible = {
  product: {
    status: "published",
    title: "Lanterna",
    handle: "lanterna",
    description: "Descrição pública",
    salesChannelIds: ["sc_public"],
    variantIds: ["variant_1"],
    variantPrices: [149],
    categoryIds: ["category_1"],
    blocked: false,
  },
  policy: {
    complianceStatus: "CLEAR",
    commercialReadiness: "READY_FOR_REVIEW",
  },
  offer: { status: "ACTIVE", primary: true },
  price: {
    status: "PRICED",
    approvedAt: "2026-08-20T00:00:00.000Z",
    approvedBy: "admin_1",
    approvedRetailPrice: "149.00",
    approvedSnapshotId: "snapshot_1",
  },
  publicSalesChannelId: "sc_public",
} as const;

describe("PublicCatalogPolicy", () => {
  it("allows a completely eligible product", () => {
    expect(policy.evaluate(eligible)).toEqual({
      eligible: true,
      approvedPrice: 149,
    });
  });

  it.each([
    ["draft", { product: { ...eligible.product, status: "draft" } }],
    ["blocked", { product: { ...eligible.product, blocked: true } }],
    [
      "review required",
      { policy: { ...eligible.policy, complianceStatus: "REVIEW_REQUIRED" } },
    ],
    ["stale pricing", { price: { ...eligible.price, status: "STALE" } }],
    ["unapproved pricing", { price: { ...eligible.price, approvedAt: null } }],
  ])("rejects %s", (_name, override) => {
    expect(policy.evaluate({ ...eligible, ...override }).eligible).toBe(false);
  });
});
