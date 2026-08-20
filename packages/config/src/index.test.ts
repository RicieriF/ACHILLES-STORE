import { describe, expect, it } from "vitest";
import { parseFeatureFlags } from "./index.js";

describe("feature flags", () => {
  it("defaults every Alibaba capability to disabled", () => {
    expect(parseFeatureFlags({})).toEqual({
      ALIBABA_PRODUCT_IMPORT: false,
      ALIBABA_FREIGHT_QUOTE: false,
      ALIBABA_ORDER_CREATE: false,
      ALIBABA_ORDER_PAY: false,
      ALIBABA_TRACKING: false,
    });
  });
  it("rejects ambiguous boolean values", () => {
    expect(() => parseFeatureFlags({ ALIBABA_ORDER_PAY: "yes" })).toThrow();
  });
});
