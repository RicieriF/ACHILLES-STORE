import { parseFeatureFlags } from "@achilles/config";
import { describe, expect, it } from "vitest";
import { CJConnector } from "./index";

describe("CJConnector", () => {
  it("is fully fail-closed by default", () => {
    expect(new CJConnector(parseFeatureFlags({})).capabilities).toEqual({
      productImport: false,
      freightQuote: false,
      orderCreate: false,
      orderPay: false,
      tracking: false,
      privateLabel: false,
    });
  });
  it("offers deterministic offline product, stock, freight and tracking", async () => {
    const connector = new CJConnector(parseFeatureFlags({}), {
      testMode: true,
      clock: () => new Date("2026-08-20T12:00:00.000Z"),
    });
    const reference = await connector.resolveProductUrl(
      "https://test.invalid/cj/item",
    );
    expect((await connector.collectProduct(reference)).metadata).toEqual({
      sandbox: true,
    });
    expect(
      (await connector.getAvailability(reference, "CJ-TEST-BLACK")).quantity,
    ).toBe(25);
    expect(
      (await connector.getShippingQuote(reference, "CJ-TEST-BLACK", "BR")).cost
        .amount,
    ).toBe("8.40");
    expect((await connector.getTracking("test")).trackingNumber).toContain(
      "TEST",
    );
  });
  it("never enables order creation or payment", () => {
    expect(
      new CJConnector(
        parseFeatureFlags({ CJ_ORDER_CREATE: "true", CJ_ORDER_PAY: "true" }),
      ).capabilities,
    ).toMatchObject({ orderCreate: false, orderPay: false });
  });
});
