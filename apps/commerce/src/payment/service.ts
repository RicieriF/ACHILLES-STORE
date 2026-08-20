import { createHash, randomUUID } from "node:crypto";
import type {
  CheckoutTotalsDTO,
  PaymentIntentStatus,
  PaymentMethod,
  ProviderPaymentResult,
  PublicPaymentIntentDTO,
} from "@achilles/domain";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { CheckoutService } from "../checkout/service";
import { CustomerOrderService } from "../orders/customer-order-service";
import { assertValidCpf, maskCpf } from "./cpf";
import { resolvePaymentProvider } from "./provider";

type QueryResult<T> = { rows: T[] };
type Database = {
  raw<T>(sql: string, bindings?: readonly unknown[]): Promise<QueryResult<T>>;
  transaction<T>(operation: (transaction: Database) => Promise<T>): Promise<T>;
};
type PaymentRecord = {
  id: string;
  checkout_session_id: string;
  taxpayer_identity_id: string | null;
  provider: "MERCADO_PAGO" | "TEST";
  provider_order_id: string | null;
  method: PaymentMethod;
  amount: string;
  currency: "BRL";
  status: PaymentIntentStatus;
  idempotency_key: string;
  external_reference: string;
  provider_status: string | null;
  failure_code: string | null;
  failure_message_safe: string | null;
  display_data: DisplayData | string | null;
  expires_at: Date | string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  normalized_value?: string | null;
};
type DisplayData = {
  pix?: ProviderPaymentResult["pix"];
  installments?: ProviderPaymentResult["installments"];
  testMode: boolean;
};

export type CreatePaymentInput = {
  checkoutId: string;
  method: PaymentMethod;
  attemptId: string;
  cpf?: string | undefined;
  card?:
    | { token: string; paymentMethodId: string; installments: number }
    | undefined;
};

export class PaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export class PaymentService {
  private readonly database: Database;
  constructor(private readonly container: MedusaContainer) {
    this.database = container.resolve<Database>(
      ContainerRegistrationKeys.PG_CONNECTION,
    );
  }

  async create(input: CreatePaymentInput): Promise<PublicPaymentIntentDTO> {
    const checkout = await new CheckoutService(this.container).retrieve(
      input.checkoutId,
    );
    if (
      !["READY_FOR_PAYMENT", "PAYMENT_FAILED"].includes(checkout.status) ||
      !checkout.readiness.ready ||
      !checkout.totals
    )
      throw new PaymentError(
        "CHECKOUT_NOT_READY",
        "O checkout precisa ser revisado antes do pagamento",
      );
    if (
      !checkout.totals.taxes.known ||
      checkout.totals.fulfillmentTaxMode === "UNKNOWN"
    )
      throw new PaymentError(
        "TAXES_UNKNOWN",
        "O pagamento está bloqueado até a definição do tratamento tributário",
      );
    if (input.method === "BOLETO")
      throw new PaymentError(
        "PAYMENT_METHOD_DISABLED",
        "Boleto não está disponível",
      );
    if (input.method === "PIX" && !input.cpf)
      throw new PaymentError("CPF_REQUIRED", "CPF é obrigatório para Pix", 400);
    const cpf = input.cpf ? safeCpf(input.cpf) : null;
    if (input.method === "CARD" && !input.card?.token)
      throw new PaymentError(
        "CARD_TOKEN_REQUIRED",
        "Token seguro do cartão é obrigatório",
        400,
      );

    const provider = safeProvider();
    const capabilities = provider.getCapabilities();
    if (
      (input.method === "PIX" && !capabilities.methods.pix) ||
      (input.method === "CARD" && !capabilities.methods.card)
    )
      throw new PaymentError(
        "PAYMENT_METHOD_DISABLED",
        "Meio de pagamento indisponível",
        503,
      );
    const idempotencyKey = createHash("sha256")
      .update(`${input.checkoutId}:${input.method}:${input.attemptId}`)
      .digest("hex");
    const existing = await this.findByIdempotency(idempotencyKey);
    if (existing) return this.present(existing);

    const id = `pay_${randomUUID().replaceAll("-", "")}`;
    const externalReference = `${input.checkoutId}:${id}`;
    const amount = checkout.totals.total.amount.toFixed(2);
    const taxpayerId = cpf ? `taxid_${randomUUID().replaceAll("-", "")}` : null;
    const created = await this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `payment:${idempotencyKey}`,
      ]);
      const duplicate = await this.findByIdempotency(idempotencyKey, trx);
      if (duplicate) return duplicate;
      const locked = await trx.raw<{
        status: string;
        totals_snapshot: CheckoutTotalsDTO | null;
      }>(
        "select status, totals_snapshot from checkout_session where id = ? and deleted_at is null for update",
        [input.checkoutId],
      );
      const session = locked.rows[0];
      if (
        !session ||
        !["READY_FOR_PAYMENT", "PAYMENT_FAILED"].includes(session.status) ||
        session.totals_snapshot?.total.amount.toFixed(2) !== amount
      )
        throw new PaymentError(
          "CHECKOUT_CHANGED",
          "O checkout mudou e precisa ser revisado novamente",
        );
      const expired = await trx.raw<{ count: string }>(
        "select count(*)::text as count from checkout_shipping_selection where checkout_session_id = ? and deleted_at is null and expires_at <= now()",
        [input.checkoutId],
      );
      if (Number(expired.rows[0]?.count ?? 1) > 0)
        throw new PaymentError(
          "SHIPPING_EXPIRED",
          "A cotação de entrega expirou",
        );
      if (cpf && taxpayerId)
        await trx.raw(
          `insert into taxpayer_identity (id, type, normalized_value, country, purpose, verified_format) values (?, 'CPF', ?, 'BR', ?, true)`,
          [taxpayerId, cpf, `PAYMENT_${input.method}`],
        );
      const result = await trx.raw<PaymentRecord>(
        `insert into payment_intent (id, checkout_session_id, taxpayer_identity_id, provider, method, amount, currency, status, idempotency_key, external_reference, display_data)
         values (?, ?, ?, ?, ?, ?, 'BRL', 'CREATED', ?, ?, ?::jsonb) returning *`,
        [
          id,
          input.checkoutId,
          taxpayerId,
          provider.name,
          input.method,
          amount,
          idempotencyKey,
          externalReference,
          JSON.stringify({ testMode: capabilities.testMode }),
        ],
      );
      await paymentAudit(
        trx,
        "PAYMENT_INTENT_CREATED",
        id,
        "Tentativa de pagamento criada",
        {
          checkout_id: input.checkoutId,
          method: input.method,
          amount,
          currency: "BRL",
          provider: provider.name,
        },
      );
      return required(result.rows[0]);
    });
    if (created.id !== id) return this.present(created);

    let providerResult: ProviderPaymentResult;
    try {
      providerResult = await provider.createPaymentIntent({
        idempotencyKey,
        externalReference,
        method: input.method,
        amount,
        currency: "BRL",
        payer: {
          email: checkout.customer?.email ?? "",
          taxpayerType: cpf ? "CPF" : undefined,
          taxpayerId: cpf ?? undefined,
        },
        card: input.card,
      });
    } catch (error) {
      const unavailable =
        error instanceof Error &&
        /DISABLED|MISSING|TEST_ONLY|50\d|timeout|fetch/i.test(error.message);
      await this.applyProviderResult(id, {
        providerOrderId: "",
        status: "FAILED",
        providerStatus: unavailable
          ? "provider_unavailable"
          : "provider_rejected",
        failureCode: unavailable ? "PROVIDER_UNAVAILABLE" : "PAYMENT_FAILED",
        failureMessageSafe: unavailable
          ? "Pagamento temporariamente indisponível. Tente novamente."
          : "Não foi possível iniciar o pagamento.",
      });
      throw new PaymentError(
        unavailable ? "PROVIDER_UNAVAILABLE" : "PAYMENT_FAILED",
        unavailable
          ? "Pagamento temporariamente indisponível"
          : "Não foi possível iniciar o pagamento",
        503,
      );
    }
    return this.present(await this.applyProviderResult(id, providerResult));
  }

  async retrieve(id: string): Promise<PublicPaymentIntentDTO> {
    return this.present(await this.getRecord(id));
  }

  async poll(id: string): Promise<PublicPaymentIntentDTO> {
    const record = await this.getRecord(id);
    if (
      !["PENDING", "PROCESSING"].includes(record.status) ||
      !record.provider_order_id
    )
      return this.present(record);
    if (record.provider === "TEST") return this.present(record);
    const result = await safeProvider().getPaymentStatus(
      record.provider_order_id,
    );
    return this.present(await this.applyProviderResult(record.id, result));
  }

  async processProviderEvent(input: {
    provider: "MERCADO_PAGO" | "TEST";
    providerEventId: string;
    providerOrderId: string;
    type: string;
    payloadHash: string;
    testStatus?: PaymentIntentStatus;
  }): Promise<PublicPaymentIntentDTO | null> {
    const processed = await this.database.transaction(async (trx) => {
      const payment = await trx.raw<PaymentRecord>(
        `select p.*, t.normalized_value from payment_intent p left join taxpayer_identity t on t.id = p.taxpayer_identity_id
         where p.provider = ? and p.provider_order_id = ? and p.deleted_at is null for update of p`,
        [input.provider, input.providerOrderId],
      );
      const record = payment.rows[0];
      const eventId = `payevt_${randomUUID().replaceAll("-", "")}`;
      const inserted = await trx.raw<{ id: string }>(
        `insert into payment_provider_event (id, provider, provider_event_id, payment_intent_id, type, received_at, status, sanitized_payload_reference)
         values (?, ?, ?, ?, ?, now(), 'RECEIVED', ?) on conflict (provider, provider_event_id) where deleted_at is null do nothing returning id`,
        [
          eventId,
          input.provider,
          input.providerEventId,
          record?.id ?? null,
          input.type,
          input.payloadHash,
        ],
      );
      if (!inserted.rows[0]) return record ?? null;
      if (!record) {
        await trx.raw(
          "update payment_provider_event set status = 'IGNORED', processed_at = now(), updated_at = now() where id = ?",
          [eventId],
        );
        return null;
      }
      const result =
        input.provider === "TEST" && input.testStatus
          ? {
              providerOrderId: input.providerOrderId,
              status: input.testStatus,
              providerStatus: `test_${input.testStatus.toLowerCase()}`,
            }
          : await safeProvider().getPaymentStatus(input.providerOrderId);
      const updated = await this.applyProviderResult(record.id, result, trx);
      await trx.raw(
        "update payment_provider_event set status = 'PROCESSED', processed_at = now(), updated_at = now() where id = ?",
        [eventId],
      );
      return updated;
    });
    return processed ? this.present(processed) : null;
  }

  async processTestEvent(input: {
    paymentIntentId: string;
    providerEventId: string;
    status: PaymentIntentStatus;
    payloadHash: string;
  }): Promise<PublicPaymentIntentDTO | null> {
    const record = await this.getRecord(input.paymentIntentId);
    if (record.provider !== "TEST" || !record.provider_order_id)
      throw new PaymentError(
        "TEST_EVENT_INVALID",
        "Evento de teste inválido",
        400,
      );
    return this.processProviderEvent({
      provider: "TEST",
      providerEventId: input.providerEventId,
      providerOrderId: record.provider_order_id,
      type: "test.payment.updated",
      testStatus: input.status,
      payloadHash: input.payloadHash,
    });
  }

  private async applyProviderResult(
    id: string,
    result: ProviderPaymentResult,
    database = this.database,
  ): Promise<PaymentRecord> {
    const displayData: DisplayData = {
      pix: result.pix,
      installments: result.installments,
      testMode:
        result.pix?.testOnly ??
        process.env.PAYMENT_TEST_PROVIDER_ENABLED === "true",
    };
    const updated = await database.raw<PaymentRecord>(
      `update payment_intent set provider_order_id = coalesce(nullif(?, ''), provider_order_id), status = ?, provider_status = ?, failure_code = ?, failure_message_safe = ?, display_data = ?::jsonb,
       expires_at = ?, paid_at = case when ? = 'PAID' then coalesce(paid_at, now()) else paid_at end, updated_at = now() where id = ? returning *`,
      [
        result.providerOrderId,
        result.status,
        result.providerStatus,
        result.failureCode ?? null,
        result.failureMessageSafe ?? null,
        JSON.stringify(displayData),
        result.expiresAt ?? null,
        result.status,
        id,
      ],
    );
    const record = required(updated.rows[0]);
    const checkoutStatus =
      result.status === "PAID"
        ? "PAID"
        : result.status === "FAILED"
          ? "PAYMENT_FAILED"
          : ["EXPIRED", "CANCELLED"].includes(result.status)
            ? "PAYMENT_FAILED"
            : ["PENDING", "PROCESSING"].includes(result.status)
              ? "PAYMENT_PENDING"
              : null;
    if (checkoutStatus)
      await database.raw(
        "update checkout_session set status = ?, version = version + 1, updated_at = now() where id = ? and status <> 'PAID'",
        [checkoutStatus, record.checkout_session_id],
      );
    await paymentAudit(
      database,
      `PAYMENT_${result.status}`,
      id,
      result.status === "PAID"
        ? "Pagamento confirmado; pedido ao fornecedor não autorizado"
        : `Pagamento ${result.status.toLowerCase()}`,
      {
        provider: record.provider,
        provider_status: result.providerStatus,
        supplier_order_authorized: false,
      },
    );
    return this.getRecord(id, database);
  }

  private async present(
    record: PaymentRecord,
  ): Promise<PublicPaymentIntentDTO> {
    if (record.status === "PAID")
      await new CustomerOrderService(this.container).ensureForPaidPayment(
        record.id,
      );
    const customerOrder =
      record.status === "PAID"
        ? await new CustomerOrderService(this.container).publicAccessForPayment(
            record.id,
          )
        : null;
    return { ...toPublic(record), customerOrder };
  }

  private async findByIdempotency(
    key: string,
    db = this.database,
  ): Promise<PaymentRecord | null> {
    const result = await db.raw<PaymentRecord>(
      `select p.*, t.normalized_value from payment_intent p left join taxpayer_identity t on t.id = p.taxpayer_identity_id where p.idempotency_key = ? and p.deleted_at is null`,
      [key],
    );
    return result.rows[0] ? normalize(result.rows[0]) : null;
  }
  private async getRecord(
    id: string,
    db = this.database,
  ): Promise<PaymentRecord> {
    const result = await db.raw<PaymentRecord>(
      `select p.*, t.normalized_value from payment_intent p left join taxpayer_identity t on t.id = p.taxpayer_identity_id where p.id = ? and p.deleted_at is null`,
      [id],
    );
    if (!result.rows[0])
      throw new PaymentError(
        "PAYMENT_NOT_FOUND",
        "Pagamento não encontrado",
        404,
      );
    return normalize(result.rows[0]);
  }
}

function safeCpf(value: string): string {
  try {
    return assertValidCpf(value);
  } catch {
    throw new PaymentError("CPF_INVALID", "Informe um CPF válido", 400);
  }
}
function safeProvider() {
  try {
    return resolvePaymentProvider();
  } catch {
    throw new PaymentError(
      "PROVIDER_UNAVAILABLE",
      "Pagamento temporariamente indisponível",
      503,
    );
  }
}
function normalize(record: PaymentRecord): PaymentRecord {
  return {
    ...record,
    display_data:
      typeof record.display_data === "string"
        ? (JSON.parse(record.display_data) as DisplayData)
        : record.display_data,
  };
}
function required(value: PaymentRecord | undefined): PaymentRecord {
  if (!value)
    throw new PaymentError(
      "PAYMENT_WRITE_FAILED",
      "Não foi possível salvar o pagamento",
      500,
    );
  return normalize(value);
}
function toPublic(value: PaymentRecord): PublicPaymentIntentDTO {
  const display = (value.display_data ?? {
    testMode: value.provider === "TEST",
  }) as DisplayData;
  const amount = Number(value.amount);
  return {
    id: value.id,
    checkoutId: value.checkout_session_id,
    provider: value.provider,
    method: value.method,
    amount: {
      amount,
      currencyCode: "brl",
      formatted: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(amount),
    },
    status: value.status,
    providerStatus: value.provider_status,
    failureCode: value.failure_code,
    failureMessage: value.failure_message_safe,
    taxpayerIdentityMasked: value.normalized_value
      ? maskCpf(value.normalized_value)
      : null,
    expiresAt: value.expires_at
      ? new Date(value.expires_at).toISOString()
      : null,
    paidAt: value.paid_at ? new Date(value.paid_at).toISOString() : null,
    createdAt: new Date(value.created_at).toISOString(),
    updatedAt: new Date(value.updated_at).toISOString(),
    testMode: display.testMode,
    pix: display.pix
      ? {
          qrCode: display.pix.qrCode ?? null,
          qrCodeBase64: display.pix.qrCodeBase64 ?? null,
          ticketUrl: display.pix.ticketUrl ?? null,
          testOnly: display.pix.testOnly,
        }
      : null,
    installments: display.installments ?? [],
    customerOrder: null,
  };
}
async function paymentAudit(
  database: Database,
  action: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await database.raw(
    `insert into audit_event (id, action, entity_type, entity_id, actor_id, summary, before, after, metadata) values (?, ?, 'payment_intent', ?, null, ?, null, null, ?::jsonb)`,
    [
      `audit_${randomUUID().replaceAll("-", "")}`,
      action,
      entityId,
      summary,
      JSON.stringify(metadata),
    ],
  );
}
