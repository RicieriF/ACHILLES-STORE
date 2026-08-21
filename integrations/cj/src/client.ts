export type CJCredentials = {
  apiKey?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  baseUrl?: string | undefined;
};

export type CJTokenState = {
  accessToken: string;
  refreshToken?: string | undefined;
  accessTokenExpiresAt?: string | undefined;
  refreshTokenExpiresAt?: string | undefined;
};

export type CJClientOptions = {
  credentials: CJCredentials;
  fetch?: typeof fetch;
  clock?: () => Date;
  timeoutMs?: number;
};

export type CJConnectionResult = {
  connected: boolean;
  health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  latencyMs: number;
  providerIdentifier: string | null;
  capabilities: {
    products: boolean;
    stock: boolean;
    freight: boolean;
    tracking: boolean;
    orderCreate: false;
    orderPay: false;
  };
  error: { code: string; message: string } | null;
};

export class CJClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly transient = false,
  ) {
    super(message);
    this.name = "CJClientError";
  }
}

type JsonRecord = Record<string, unknown>;
type CacheEntry = { expiresAt: number; value: unknown };

const DEFAULT_BASE_URL = "https://developers.cjdropshipping.com";
const AUTH_PATH = "/api2.0/v1/authentication/getAccessToken";
const REFRESH_PATH = "/api2.0/v1/authentication/refreshAccessToken";

const asRecord = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const tokenFrom = (payload: unknown): CJTokenState => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const accessToken = text(data.accessToken);
  if (!accessToken)
    throw new CJClientError(
      "CJ_AUTH_INVALID_RESPONSE",
      "A CJ não retornou um token válido.",
    );
  return {
    accessToken,
    refreshToken: text(data.refreshToken),
    accessTokenExpiresAt: text(data.accessTokenExpiryDate),
    refreshTokenExpiresAt: text(data.refreshTokenExpiryDate),
  };
};

export class CJApiClient {
  private readonly fetcher: typeof fetch;
  private readonly clock: () => Date;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private token: CJTokenState | null;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly options: CJClientOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.clock = options.clock ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.baseUrl = (options.credentials.baseUrl || DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.token = options.credentials.accessToken
      ? {
          accessToken: options.credentials.accessToken,
          refreshToken: options.credentials.refreshToken,
        }
      : null;
  }

  async authenticate(forceRefresh = false): Promise<void> {
    if (
      !forceRefresh &&
      this.token &&
      !this.isExpired(this.token.accessTokenExpiresAt)
    )
      return;
    if (this.token?.refreshToken || this.options.credentials.refreshToken) {
      try {
        this.token = tokenFrom(
          await this.requestJson(REFRESH_PATH, {
            method: "POST",
            body: JSON.stringify({
              refreshToken:
                this.token?.refreshToken ??
                this.options.credentials.refreshToken,
            }),
          }),
        );
        return;
      } catch (error) {
        if (!this.options.credentials.apiKey) throw error;
      }
    }
    if (!this.options.credentials.apiKey)
      throw new CJClientError(
        "CJ_NOT_CONFIGURED",
        "CJ não configurado. Adicione a API Key no ambiente.",
      );
    this.token = tokenFrom(
      await this.requestJson(AUTH_PATH, {
        method: "POST",
        body: JSON.stringify({ apiKey: this.options.credentials.apiKey }),
      }),
    );
  }

  async testConnection(): Promise<CJConnectionResult> {
    const started = Date.now();
    try {
      await this.warehouses();
      return this.connection(true, "HEALTHY", Date.now() - started, null);
    } catch (error) {
      const safe = sanitizeCJError(error);
      return this.connection(
        false,
        safe.code === "CJ_NOT_CONFIGURED" ? "DEGRADED" : "UNAVAILABLE",
        Date.now() - started,
        safe,
      );
    }
  }

  searchProducts(
    query: Record<string, string | number | undefined>,
  ): Promise<unknown> {
    return this.authorizedGet("/api2.0/v1/product/listV2", query, 30_000);
  }

  product(pid: string): Promise<unknown> {
    return this.authorizedGet("/api2.0/v1/product/query", { pid }, 300_000);
  }

  variants(query: {
    pid?: string;
    productSku?: string;
    variantSku?: string;
    countryCode?: string;
  }): Promise<unknown> {
    return this.authorizedGet(
      "/api2.0/v1/product/variant/query",
      query,
      300_000,
    );
  }

  stockByVid(vid: string): Promise<unknown> {
    return this.authorizedGet(
      "/api2.0/v1/product/stock/queryByVid",
      { vid },
      15_000,
    );
  }

  warehouses(): Promise<unknown> {
    return this.authorizedGet(
      "/api2.0/v1/product/globalWarehouseList",
      {},
      3_600_000,
    );
  }

  freight(input: unknown): Promise<unknown> {
    return this.authorizedJson("/api2.0/v1/logistic/freightCalculate", input);
  }

  tracking(input: unknown): Promise<unknown> {
    return this.authorizedJson("/api2.0/v1/logistic/trackInfo", input);
  }

  private async authorizedGet(
    path: string,
    query: Record<string, string | number | undefined>,
    ttlMs: number,
  ): Promise<unknown> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const target = `${path}${params.size ? `?${params}` : ""}`;
    const cached = this.cache.get(target);
    if (cached && cached.expiresAt > this.clock().getTime())
      return cached.value;
    const value = await this.authorized(target);
    this.cache.set(target, {
      expiresAt: this.clock().getTime() + ttlMs,
      value,
    });
    return value;
  }

  private authorizedJson(path: string, body: unknown): Promise<unknown> {
    return this.authorized(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async authorized(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    await this.authenticate();
    try {
      return await this.requestJson(path, init, this.token?.accessToken);
    } catch (error) {
      if (error instanceof CJClientError && error.code === "CJ_UNAUTHORIZED") {
        await this.authenticate(true);
        return this.requestJson(path, init, this.token?.accessToken);
      }
      throw error;
    }
  }

  private async requestJson(
    path: string,
    init: RequestInit,
    accessToken?: string,
  ): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);
      try {
        const headers = new Headers(init.headers);
        headers.set("content-type", "application/json");
        if (accessToken) headers.set("CJ-Access-Token", accessToken);
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => ({}));
        const record = asRecord(payload);
        const providerCode =
          typeof record.code === "string" || typeof record.code === "number"
            ? String(record.code)
            : "";
        if (response.status === 401 || providerCode === "1600101")
          throw new CJClientError(
            "CJ_UNAUTHORIZED",
            "Token CJ expirado ou inválido. Atualize a autorização.",
          );
        if (
          !response.ok ||
          (record.result === false && providerCode !== "200")
        ) {
          const transient = response.status === 429 || response.status >= 500;
          throw new CJClientError(
            transient ? "CJ_TEMPORARILY_UNAVAILABLE" : "CJ_REQUEST_REJECTED",
            transient
              ? "CJ temporariamente indisponível."
              : "A CJ rejeitou a solicitação.",
            transient,
          );
        }
        return payload;
      } catch (error) {
        lastError = error;
        const transient =
          error instanceof CJClientError
            ? error.transient
            : error instanceof DOMException && error.name === "AbortError";
        if (!transient || attempt === 1) break;
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof CJClientError) throw lastError;
    throw new CJClientError(
      "CJ_UNAVAILABLE",
      "Não foi possível consultar a CJ.",
      true,
    );
  }

  private isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    const expiry = Date.parse(expiresAt);
    return Number.isNaN(expiry) || expiry <= this.clock().getTime() + 60_000;
  }

  private connection(
    connected: boolean,
    health: CJConnectionResult["health"],
    latencyMs: number,
    error: CJConnectionResult["error"],
  ): CJConnectionResult {
    return {
      connected,
      health,
      latencyMs,
      providerIdentifier: null,
      capabilities: {
        products: connected,
        stock: connected,
        freight: connected,
        tracking: connected,
        orderCreate: false,
        orderPay: false,
      },
      error,
    };
  }
}

export function sanitizeCJError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof CJClientError)
    return { code: error.code, message: error.message };
  return {
    code: "CJ_UNAVAILABLE",
    message: "Não foi possível consultar a CJ.",
  };
}

export function cjClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): CJApiClient {
  const fixture =
    environment.APP_ENV === "test" && environment.CJ_TEST_MODE === "true";
  return new CJApiClient({
    credentials: {
      apiKey: environment.CJ_API_KEY,
      accessToken: environment.CJ_ACCESS_TOKEN,
      refreshToken: environment.CJ_REFRESH_TOKEN,
      baseUrl: environment.CJ_BASE_URL,
    },
    ...(fixture ? { fetch: cjFixtureFetch } : {}),
  });
}

const cjFixtureFetch: typeof fetch = (input, _init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const data = url.includes("authentication")
    ? {
        accessToken: "fixture-token-never-exposed",
        refreshToken: "fixture-refresh-never-exposed",
        accessTokenExpiryDate: "2099-01-01T00:00:00Z",
      }
    : url.includes("globalWarehouseList")
      ? [{ areaEn: "China Warehouse", countryCode: "CN" }]
      : url.includes("variant/query")
        ? [
            {
              vid: "CJ-FIXTURE-VID",
              variantSku: "CJ-FIXTURE-SKU",
              variantNameEn: "Black",
            },
          ]
        : url.includes("stock/queryByVid")
          ? [
              {
                areaEn: "China Warehouse",
                countryCode: "CN",
                totalInventoryNum: 25,
              },
            ]
          : url.includes("freightCalculate")
            ? [
                {
                  logisticName: "CJPacket",
                  logisticPrice: 8.4,
                  logisticAging: "14-28",
                },
              ]
            : url.includes("trackInfo")
              ? [{ trackingNumber: "CJ-FIXTURE-TRACK", status: "IN_TRANSIT" }]
              : url.includes("product/query")
                ? {
                    pid: "CJ-FIXTURE-001",
                    productNameEn: "Fixture CJ EDC Organizer",
                    productSku: "CJ-FIXTURE-SKU",
                    sellPrice: "12.50",
                    productImage: "https://example.invalid/cj-fixture.png",
                  }
                : {
                    list: [
                      {
                        pid: "CJ-FIXTURE-001",
                        productNameEn: "Fixture CJ EDC Organizer",
                        productSku: "CJ-FIXTURE-SKU",
                        sellPrice: "12.50",
                        productImage: "https://example.invalid/cj-fixture.png",
                      },
                    ],
                    total: 1,
                  };
  return Promise.resolve(
    new Response(JSON.stringify({ result: true, code: 200, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
};
