import { describe, expect, it } from "vitest";
import { parseFeatureFlags } from "@achilles/config";
import { AlibabaCapabilityDisabledError, AlibabaConnector } from "./index.js";

describe("AlibabaConnector safety boundary", () => {
  it("defaults every capability to off", () => {
    expect(new AlibabaConnector(parseFeatureFlags({})).capabilities).toEqual({
      productImport: false,
      freightQuote: false,
      orderCreate: false,
      orderPay: false,
      tracking: false,
      privateLabel: false,
    });
  });
  it("never fakes a successful external read", async () => {
    const connector = new AlibabaConnector(parseFeatureFlags({}));
    await expect(
      connector.getProduct({
        provider: "ALIBABA",
        supplierProductId: "example",
        sourceUrl: "https://example.invalid",
      }),
    ).rejects.toBeInstanceOf(AlibabaCapabilityDisabledError);
  });
});
