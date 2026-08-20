import { describe, expect, it } from "vitest";
import { fulfillmentModes, importTaxStrategyKinds } from "./index.js";

describe("domain contracts", () => {
  it("keeps every required fulfillment mode", () => {
    expect(fulfillmentModes).toEqual([
      "PRIVATE_LABEL_DROPSHIP",
      "GENERIC_DROPSHIP",
      "BRAZIL_STOCK",
    ]);
  });
  it("never models a tax estimate as guaranteed", () => {
    expect(importTaxStrategyKinds).toContain("MANUAL_QUOTE");
  });
});
