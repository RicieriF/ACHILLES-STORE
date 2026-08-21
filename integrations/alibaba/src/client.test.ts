import { describe, expect, it, vi } from "vitest";
import { AlibabaApiClient, sanitizeAlibabaError } from "./client.js";

const credentials = {
  appKey: "app-key",
  appSecret: "server-secret",
  accessToken: "access-token",
};
describe("Alibaba official API client", () => {
  it("reports missing authorization without making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await new AlibabaApiClient(
      { appKey: "key", appSecret: "secret" },
      { fetch: fetcher },
    ).testConnection("123456");
    expect(result).toMatchObject({
      connected: false,
      error: { code: "ALIBABA_PERMISSION_REQUIRED" },
      capabilities: { orderCreate: false, orderPay: false },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses the official product method and never sends the secret", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          alibaba_dropshipping_product_get_response: {
            value: { distribution_sale_product: [] },
          },
        }),
        { status: 200 },
      ),
    );
    await new AlibabaApiClient(credentials, {
      fetch: fetcher,
      clock: () => new Date("2026-08-21T00:00:00Z"),
    }).product("123456");
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    const body = (init?.body as URLSearchParams).toString();
    expect(body).toContain("alibaba.dropshipping.product.get");
    expect(body).toContain("session=access-token");
    expect(body).not.toContain("server-secret");
    expect(body).not.toContain("order.create");
    expect(body).not.toContain("order.pay");
  });
  it("sanitizes provider errors", () => {
    expect(
      JSON.stringify(sanitizeAlibabaError(new Error("token=real-secret"))),
    ).not.toContain("real-secret");
  });
});
