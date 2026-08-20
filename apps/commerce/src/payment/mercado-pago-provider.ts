import { randomUUID } from "node:crypto";
import type {
  CreateProviderPaymentInput,
  CustomerPaymentProvider,
  PaymentCapabilitiesDTO,
  PaymentIntentStatus,
  ProviderPaymentResult,
} from "@achilles/domain";
import { z } from "zod";

type MercadoPagoConfig = {
  environment: string | undefined;
  accessToken: string | undefined;
  publicKey: string | undefined;
  pix: boolean;
  card: boolean;
  boleto: boolean;
};

const responseSchema = z.object({
  id: z.string(),
  status: z.string(),
  status_detail: z.string().optional(),
  transactions: z
    .object({
      payments: z
        .array(
          z.object({
            id: z.string().optional(),
            status: z.string().optional(),
            status_detail: z.string().optional(),
            expiration_time: z.string().optional(),
            payment_method: z
              .object({
                id: z.string().optional(),
                type: z.string().optional(),
                ticket_url: z.url().optional(),
                qr_code: z.string().optional(),
                qr_code_base64: z.string().optional(),
              })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export class MercadoPagoPaymentProvider implements CustomerPaymentProvider {
  readonly name = "MERCADO_PAGO" as const;
  private readonly accessToken: string;
  constructor(private readonly config: MercadoPagoConfig) {
    if (config.environment !== "TEST")
      throw new Error("MERCADO_PAGO_TEST_ONLY");
    if (!config.accessToken?.trim())
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN_MISSING");
    this.accessToken = config.accessToken;
  }

  async createPaymentIntent(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentResult> {
    if (input.method === "PIX" && !this.config.pix)
      throw new Error("PAYMENT_METHOD_DISABLED");
    if (input.method === "CARD" && !this.config.card)
      throw new Error("PAYMENT_METHOD_DISABLED");
    const paymentMethod =
      input.method === "PIX"
        ? { id: "pix", type: "bank_transfer" }
        : {
            id: input.card?.paymentMethodId,
            type: "credit_card",
            token: input.card?.token,
            installments: input.card?.installments,
          };
    const payload = {
      type: "online",
      processing_mode: "automatic",
      external_reference: input.externalReference,
      total_amount: input.amount,
      payer: {
        email: input.payer.email,
        ...(input.payer.taxpayerId
          ? { identification: { type: "CPF", number: input.payer.taxpayerId } }
          : {}),
      },
      transactions: {
        payments: [{ amount: input.amount, payment_method: paymentMethod }],
      },
    };
    return this.request("POST", "/v1/orders", input.idempotencyKey, payload);
  }

  async getPaymentStatus(
    providerOrderId: string,
  ): Promise<ProviderPaymentResult> {
    return this.request(
      "GET",
      `/v1/orders/${encodeURIComponent(providerOrderId)}`,
    );
  }

  async cancelPayment(providerOrderId: string): Promise<ProviderPaymentResult> {
    return this.request(
      "POST",
      `/v1/orders/${encodeURIComponent(providerOrderId)}/cancel`,
      randomUUID(),
      {},
    );
  }

  refundPayment(): Promise<never> {
    return Promise.reject(
      new Error("REFUND_REQUIRES_FUTURE_APPROVAL_WORKFLOW"),
    );
  }

  getCapabilities(): PaymentCapabilitiesDTO {
    return {
      provider: "MERCADO_PAGO",
      testMode: true,
      health: "HEALTHY",
      methods: { pix: this.config.pix, card: this.config.card, boleto: false },
      publicKey: this.config.publicKey?.trim() || null,
    };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    idempotencyKey?: string,
    body?: object,
  ): Promise<ProviderPaymentResult> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.accessToken}`,
    };
    if (body) headers["content-type"] = "application/json";
    if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(10_000),
    };
    if (body) init.body = JSON.stringify(body);
    const response = await fetch(`https://api.mercadopago.com${path}`, init);
    const raw: unknown = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(`MERCADO_PAGO_${String(response.status)}`);
    const parsed = responseSchema.parse(raw);
    return mapResponse(parsed);
  }
}

function mapResponse(
  value: z.infer<typeof responseSchema>,
): ProviderPaymentResult {
  const payment = value.transactions?.payments?.[0];
  const rawStatus = payment?.status ?? value.status;
  const detail = payment?.status_detail ?? value.status_detail ?? rawStatus;
  return {
    providerOrderId: value.id,
    status: mapStatus(rawStatus, detail),
    providerStatus: detail,
    failureCode: /reject|fail/i.test(rawStatus)
      ? "PAYMENT_DECLINED"
      : undefined,
    failureMessageSafe: /reject|fail/i.test(rawStatus)
      ? "Pagamento recusado. Revise os dados, tente outro cartão ou escolha Pix."
      : undefined,
    expiresAt: payment?.expiration_time,
    pix: payment?.payment_method?.qr_code
      ? {
          qrCode: payment.payment_method.qr_code,
          qrCodeBase64: payment.payment_method.qr_code_base64,
          ticketUrl: payment.payment_method.ticket_url,
          testOnly: true,
        }
      : undefined,
  };
}

function mapStatus(status: string, detail: string): PaymentIntentStatus {
  const value = `${status}:${detail}`.toLowerCase();
  if (/accredited|processed/.test(value)) return "PAID";
  if (/cancel/.test(value)) return "CANCELLED";
  if (/expir/.test(value)) return "EXPIRED";
  if (/reject|fail/.test(value)) return "FAILED";
  if (/process/.test(value)) return "PROCESSING";
  return "PENDING";
}
