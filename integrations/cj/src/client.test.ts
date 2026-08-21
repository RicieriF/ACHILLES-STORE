import { describe, expect, it, vi } from "vitest";
import { CJApiClient } from "./client";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("CJApiClient", () => {
  it("falha fechado e sanitiza quando não configurado", async () => {
    const client = new CJApiClient({ credentials: {}, fetch: vi.fn() });
    const result = await client.testConnection();
    expect(result.connected).toBe(false);
    expect(result.error?.code).toBe("CJ_NOT_CONFIGURED");
    expect(JSON.stringify(result)).not.toContain("accessToken");
  });

  it("obtém token uma vez e consulta Product List V2", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          result: true,
          code: 200,
          data: {
            accessToken: "secret-token",
            refreshToken: "refresh-secret",
            accessTokenExpiryDate: "2099-01-01T00:00:00Z",
          },
        }),
      )
      .mockResolvedValue(
        response({ result: true, code: 200, data: { list: [] } }),
      );
    const client = new CJApiClient({
      credentials: { apiKey: "api-secret" },
      fetch: fetcher,
    });
    await client.searchProducts({ keyWord: "lanterna", page: 1, size: 20 });
    await client.searchProducts({ keyWord: "lanterna", page: 1, size: 20 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining("/api2.0/v1/product/listV2"),
    );
    expect(
      new Headers(fetcher.mock.calls[1]?.[1]?.headers).get("CJ-Access-Token"),
    ).toBe("secret-token");
  });

  it("renova token com refresh e mantém pedidos e pagamentos fora das capabilities", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          result: true,
          code: 200,
          data: {
            accessToken: "renewed",
            refreshToken: "refresh-2",
            accessTokenExpiryDate: "2099-01-01T00:00:00Z",
          },
        }),
      )
      .mockResolvedValueOnce(response({ result: true, code: 200, data: [] }));
    const client = new CJApiClient({
      credentials: { refreshToken: "refresh-1" },
      fetch: fetcher,
    });
    const result = await client.testConnection();
    expect(fetcher.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("refreshAccessToken"),
    );
    expect(result.capabilities.orderCreate).toBe(false);
    expect(result.capabilities.orderPay).toBe(false);
  });
});
