import { createHmac } from "node:crypto";

export type AlibabaCredentials = {
  appKey?: string | undefined;
  appSecret?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  gatewayUrl?: string | undefined;
};

export type AlibabaConnectionResult = {
  connected: boolean;
  health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED";
  latencyMs: number;
  capabilities: {
    productLookup: boolean;
    supplierData: boolean;
    freight: boolean;
    tracking: boolean;
    orderCreate: false;
    orderPay: false;
  };
  permissions: Record<string, "GRANTED" | "NOT_VALIDATED" | "REQUIRED">;
  error: { code: string; message: string } | null;
};

export class AlibabaClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly transient = false,
  ) {
    super(message);
    this.name = "AlibabaClientError";
  }
}

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const DEFAULT_GATEWAY = "https://eco.taobao.com/router/rest";
let runtimeAccessToken: string | undefined;

export class AlibabaApiClient {
  private readonly fetcher: typeof fetch;
  private readonly gateway: string;
  private readonly clock: () => Date;
  private readonly timeoutMs: number;

  constructor(
    private readonly credentials: AlibabaCredentials,
    options: {
      fetch?: typeof fetch;
      clock?: () => Date;
      timeoutMs?: number;
    } = {},
  ) {
    this.fetcher = options.fetch ?? fetch;
    this.clock = options.clock ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.gateway = credentials.gatewayUrl || DEFAULT_GATEWAY;
  }

  async testConnection(productId?: string): Promise<AlibabaConnectionResult> {
    const started = Date.now();
    if (!this.credentials.appKey || !this.credentials.appSecret)
      return this.connection(false, "NOT_CONFIGURED", Date.now() - started, {
        code: "ALIBABA_NOT_CONFIGURED",
        message: "Alibaba App Key não configurada.",
      });
    if (!this.session())
      return this.connection(false, "DEGRADED", Date.now() - started, {
        code: "ALIBABA_PERMISSION_REQUIRED",
        message:
          "Alibaba App configurada, mas autorização ainda não foi concedida.",
      });
    if (!productId)
      return this.connection(false, "DEGRADED", Date.now() - started, {
        code: "ALIBABA_HEALTHCHECK_PRODUCT_REQUIRED",
        message:
          "Configure um Product ID autorizado para validar a permissão de produto.",
      });
    try {
      await this.product(productId);
      return this.connection(true, "HEALTHY", Date.now() - started, null);
    } catch (error) {
      const safe = sanitizeAlibabaError(error);
      return this.connection(
        false,
        safe.code.includes("PERMISSION") ? "DEGRADED" : "UNAVAILABLE",
        Date.now() - started,
        safe,
      );
    }
  }

  product(productId: string): Promise<unknown> {
    if (!/^\d{3,30}$/.test(productId))
      return Promise.reject(
        new AlibabaClientError(
          "ALIBABA_INVALID_PRODUCT_ID",
          "Product ID Alibaba inválido.",
        ),
      );
    return this.call("alibaba.dropshipping.product.get", {
      param_distribution_sale_product_request: JSON.stringify({
        product_ids: [Number(productId)],
      }),
    });
  }

  freight(input: {
    productId: string;
    quantity: number;
    zipCode?: string;
    dispatchLocation?: string;
  }): Promise<unknown> {
    return this.call("alibaba.shipping.freight.calculate", {
      param_freight_template_request: JSON.stringify({
        destination_country: "BR",
        product_id: Number(input.productId),
        quantity: input.quantity,
        ...(input.zipCode ? { zip_code: input.zipCode } : {}),
        ...(input.dispatchLocation
          ? { dispatch_location: input.dispatchLocation }
          : {}),
      }),
    });
  }

  tracking(tradeId: string): Promise<unknown> {
    return this.call("alibaba.order.logistics.tracking.get", {
      trade_id: tradeId,
    });
  }

  async exchangeAuthorizationCode(code: string): Promise<void> {
    const payload = await this.call(
      "taobao.top.auth.token.create",
      { code },
      false,
    );
    const root = record(payload);
    const response = record(root.top_auth_token_create_response);
    const tokenValue = response.token_result;
    const tokenRecord =
      typeof tokenValue === "string"
        ? record(JSON.parse(tokenValue) as unknown)
        : record(tokenValue);
    const accessToken =
      typeof tokenRecord.access_token === "string"
        ? tokenRecord.access_token
        : undefined;
    if (!accessToken)
      throw new AlibabaClientError(
        "ALIBABA_AUTH_INVALID_RESPONSE",
        "Alibaba não retornou access token válido.",
      );
    runtimeAccessToken = accessToken;
  }

  private async call(
    method: string,
    parameters: Record<string, string>,
    authorized = true,
  ): Promise<unknown> {
    if (!this.credentials.appKey || !this.credentials.appSecret)
      throw new AlibabaClientError(
        "ALIBABA_NOT_CONFIGURED",
        "Alibaba App Key não configurada.",
      );
    const session = this.session();
    if (authorized && !session)
      throw new AlibabaClientError(
        "ALIBABA_PERMISSION_REQUIRED",
        "Alibaba App configurada, mas autorização ainda não foi concedida.",
      );
    const common: Record<string, string> = {
      method,
      app_key: this.credentials.appKey,
      sign_method: "hmac",
      timestamp: formatGmt8(this.clock()),
      format: "json",
      v: "2.0",
      simplify: "false",
      ...(authorized && session ? { session } : {}),
      ...parameters,
    };
    const signBase = Object.keys(common)
      .sort()
      .map((key) => `${key}${common[key] ?? ""}`)
      .join("");
    const sign = createHmac("md5", this.credentials.appSecret)
      .update(signBase, "utf8")
      .digest("hex")
      .toUpperCase();
    const body = new URLSearchParams({ ...common, sign });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const response = await this.fetcher(this.gateway, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => ({}));
      const error = record(record(payload).error_response);
      if (!response.ok || Object.keys(error).length) {
        const subCode =
          typeof error.sub_code === "string" ? error.sub_code : "";
        const permission = /permission|session|authorize/i.test(subCode);
        throw new AlibabaClientError(
          permission
            ? "ALIBABA_PERMISSION_REQUIRED"
            : response.status >= 500
              ? "ALIBABA_UNAVAILABLE"
              : "ALIBABA_REQUEST_REJECTED",
          permission
            ? "Esta aplicação ainda não possui permissão para esta operação."
            : response.status >= 500
              ? "Alibaba temporariamente indisponível."
              : "Alibaba rejeitou a solicitação.",
          response.status >= 500,
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof AlibabaClientError) throw error;
      throw new AlibabaClientError(
        "ALIBABA_UNAVAILABLE",
        "Alibaba temporariamente indisponível.",
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private session(): string | undefined {
    return runtimeAccessToken ?? this.credentials.accessToken;
  }

  private connection(
    connected: boolean,
    health: AlibabaConnectionResult["health"],
    latencyMs: number,
    error: AlibabaConnectionResult["error"],
  ): AlibabaConnectionResult {
    return {
      connected,
      health,
      latencyMs,
      capabilities: {
        productLookup: connected,
        supplierData: connected,
        freight: connected,
        tracking: connected,
        orderCreate: false,
        orderPay: false,
      },
      permissions: {
        productLookup: connected
          ? "GRANTED"
          : error?.code === "ALIBABA_PERMISSION_REQUIRED"
            ? "REQUIRED"
            : "NOT_VALIDATED",
        freight: "NOT_VALIDATED",
        tracking: "NOT_VALIDATED",
      },
      error,
    };
  }
}

export function sanitizeAlibabaError(error: unknown): {
  code: string;
  message: string;
} {
  return error instanceof AlibabaClientError
    ? { code: error.code, message: error.message }
    : {
        code: "ALIBABA_UNAVAILABLE",
        message: "Alibaba temporariamente indisponível.",
      };
}

export function alibabaClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AlibabaApiClient {
  return new AlibabaApiClient(
    {
      appKey: environment.ALIBABA_APP_KEY,
      appSecret: environment.ALIBABA_APP_SECRET,
      accessToken: environment.ALIBABA_ACCESS_TOKEN,
      refreshToken: environment.ALIBABA_REFRESH_TOKEN,
      gatewayUrl: environment.ALIBABA_API_BASE_URL,
    },
    environment.APP_ENV === "test" && environment.ALIBABA_TEST_MODE === "true"
      ? { fetch: alibabaFixtureFetch }
      : {},
  );
}

function formatGmt8(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 19).replace("T", " ");
}

const alibabaFixtureFetch: typeof fetch = (_input, init) => {
  const method =
    init?.body instanceof URLSearchParams ? init.body.get("method") : "";
  const payload =
    method === "alibaba.shipping.freight.calculate"
      ? {
          alibaba_shipping_freight_calculate_response: {
            result: {
              freight: [
                {
                  vendor: "Fixture Express",
                  fee: { amount: "18.50", currency: "USD" },
                  delivery_time: "8-12 days",
                },
              ],
            },
          },
        }
      : method === "alibaba.order.logistics.tracking.get"
        ? {
            alibaba_order_logistics_tracking_get_response: {
              result: {
                carrier_name: "Fixture Carrier",
                tracking_number: "FIXTURE123",
                events: [],
              },
            },
          }
        : {
            alibaba_dropshipping_product_get_response: {
              value: {
                distribution_sale_product: [
                  {
                    product_id: 123456,
                    name: "Fixture Alibaba EDC",
                    main_image_url: "https://example.invalid/alibaba.png",
                    detail_url:
                      "https://www.alibaba.com/product-detail/fixture_123456.html",
                    price_range: "10.20~12.40",
                    moq_and_price: {
                      min_order_quantity: "1",
                      moq_unit_price: { amount: "10.20", currency: "USD" },
                    },
                    product_sku_list: [],
                  },
                ],
              },
            },
          };
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
};
