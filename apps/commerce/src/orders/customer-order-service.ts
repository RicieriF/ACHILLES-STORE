import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { PublicCustomerOrderDTO, PublicMoneyDTO } from "@achilles/domain";
import type { MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils";
import { createOrderWorkflow } from "@medusajs/medusa/core-flows";
import { FulfillmentService } from "../fulfillment/service";
import { emitFulfillmentEvent } from "../fulfillment/events";

type QueryResult<T> = { rows: T[] };
export type OrderDatabase = {
  raw<T>(sql: string, bindings?: readonly unknown[]): Promise<QueryResult<T>>;
  transaction<T>(
    operation: (transaction: OrderDatabase) => Promise<T>,
  ): Promise<T>;
};
type CheckoutRecord = {
  id: string;
  cart_id: string;
  email: string;
  customer_name: string;
  phone: string;
  destination: AddressSnapshot | string;
  cart_snapshot: CartSnapshot | string;
  selected_shipping: { items: ShippingSnapshot[] } | string;
  totals_snapshot: { total: { amount: number }; currencyCode: string } | string;
};
type NormalizedCheckoutRecord = Omit<
  CheckoutRecord,
  "destination" | "cart_snapshot" | "selected_shipping" | "totals_snapshot"
> & {
  destination: AddressSnapshot;
  cart_snapshot: CartSnapshot;
  selected_shipping: { items: ShippingSnapshot[] };
  totals_snapshot: { total: { amount: number }; currencyCode: string };
};
type AddressSnapshot = {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: "BR";
};
type CartSnapshot = {
  items: Array<{
    id: string;
    productTitle: string;
    variantTitle: string;
    variantId: string;
    quantity: number;
    unitPrice: { amount: number };
  }>;
};
type ShippingSnapshot = {
  groupId: string;
  quoteId: string;
  methodName: string;
  price: { amount: number };
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
};
type PaymentRecord = {
  id: string;
  checkout_session_id: string;
  status: string;
  amount: string;
  currency: string;
  paid_at: Date | string | null;
};
export type CustomerOrderRecord = {
  id: string;
  medusa_order_id: string;
  payment_intent_id: string;
  checkout_session_id: string;
  reference: string;
  access_token_hash: string;
  status: PublicCustomerOrderDTO["status"];
  currency: string;
  total_paid: string;
  customer_snapshot: { name: string; email: string; phone: string } | string;
  address_snapshot: AddressSnapshot | string;
  items_snapshot: CartSnapshot["items"] | string;
  shipping_snapshot: ShippingSnapshot[] | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export class CustomerOrderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "CustomerOrderError";
  }
}

export class CustomerOrderService {
  private readonly database: OrderDatabase;
  constructor(private readonly container: MedusaContainer) {
    this.database = container.resolve<OrderDatabase>(
      ContainerRegistrationKeys.PG_CONNECTION,
    );
  }

  async ensureForPaidPayment(
    paymentIntentId: string,
  ): Promise<CustomerOrderRecord> {
    const order = await this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `customer-order:${paymentIntentId}`,
      ]);
      const existing = await this.findByPayment(paymentIntentId, trx);
      if (existing) return existing;
      const paymentResult = await trx.raw<PaymentRecord>(
        "select id, checkout_session_id, status, amount, currency, paid_at from payment_intent where id = ? and deleted_at is null for update",
        [paymentIntentId],
      );
      const payment = paymentResult.rows[0];
      if (!payment || payment.status !== "PAID")
        throw new CustomerOrderError(
          "PAYMENT_NOT_PAID",
          "Pedido só pode ser criado após pagamento confirmado",
        );
      const checkoutResult = await trx.raw<CheckoutRecord>(
        "select id, cart_id, email, customer_name, phone, destination, cart_snapshot, selected_shipping, totals_snapshot from checkout_session where id = ? and deleted_at is null",
        [payment.checkout_session_id],
      );
      const checkout = normalizeCheckout(checkoutResult.rows[0]);
      if (!checkout)
        throw new CustomerOrderError(
          "CHECKOUT_NOT_FOUND",
          "Checkout pago não encontrado",
          500,
        );
      const cartContext = await this.cartContext(checkout.cart_id);
      const name = splitName(checkout.customer_name);
      const { result: medusaOrder } = await createOrderWorkflow(
        this.container,
      ).run({
        input: {
          region_id: cartContext.region_id,
          sales_channel_id: cartContext.sales_channel_id,
          email: checkout.email,
          currency_code: "brl",
          status: "pending",
          shipping_address: {
            first_name: name.first,
            last_name: name.last,
            phone: checkout.phone,
            address_1: `${checkout.destination.street}, ${checkout.destination.number}`,
            address_2: checkout.destination.complement,
            city: checkout.destination.city,
            province: checkout.destination.state,
            postal_code: checkout.destination.postalCode,
            country_code: "br",
            metadata: { neighborhood: checkout.destination.neighborhood },
          },
          items: checkout.cart_snapshot.items.map((item) => ({
            variant_id: item.variantId,
            title: item.productTitle,
            subtitle: item.variantTitle,
            quantity: item.quantity,
            unit_price: item.unitPrice.amount,
          })),
          shipping_methods: checkout.selected_shipping.items.map(
            (selection) => ({
              name: selection.methodName,
              amount: selection.price.amount,
              data: { achilles_shipping_quote_id: selection.quoteId },
            }),
          ),
          metadata: {
            achilles_payment_intent_id: payment.id,
            achilles_checkout_session_id: checkout.id,
            achilles_total_paid: payment.amount,
          },
        },
      });
      const sequence = await trx.raw<{ value: string }>(
        `select nextval('achilles_order_reference_seq')::text as value`,
      );
      const reference = `ACH-${String(new Date().getUTCFullYear())}-${(sequence.rows[0]?.value ?? "0").padStart(6, "0")}`;
      const id = `achord_${randomUUID().replaceAll("-", "")}`;
      const token = accessToken(id, reference);
      const inserted = await trx.raw<CustomerOrderRecord>(
        `insert into customer_order (id, medusa_order_id, payment_intent_id, checkout_session_id, reference, access_token_hash, status, currency, total_paid, customer_snapshot, address_snapshot, items_snapshot, shipping_snapshot)
         values (?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb) returning *`,
        [
          id,
          medusaOrder.id,
          payment.id,
          checkout.id,
          reference,
          hashToken(token),
          payment.currency,
          payment.amount,
          JSON.stringify({
            name: checkout.customer_name,
            email: checkout.email,
            phone: checkout.phone,
          }),
          JSON.stringify(checkout.destination),
          JSON.stringify(checkout.cart_snapshot.items),
          JSON.stringify(checkout.selected_shipping.items),
        ],
      );
      await audit(
        trx,
        "CUSTOMER_ORDER_CREATED",
        id,
        "Customer Order criado a partir de pagamento confirmado",
        {
          medusa_order_id: medusaOrder.id,
          payment_intent_id: payment.id,
          reference,
        },
      );
      await emitFulfillmentEvent(this.container, "customer_order.created", {
        customer_order_id: id,
        medusa_order_id: medusaOrder.id,
        payment_intent_id: payment.id,
      });
      return normalizeOrder(required(inserted.rows[0]));
    });
    await new FulfillmentService(this.container).ensurePlan(order.id);
    return (await this.findByPayment(paymentIntentId)) ?? order;
  }

  async publicAccessForPayment(
    paymentIntentId: string,
  ): Promise<{ reference: string; accessToken: string } | null> {
    const order = await this.findByPayment(paymentIntentId);
    return order
      ? {
          reference: order.reference,
          accessToken: accessToken(order.id, order.reference),
        }
      : null;
  }

  async retrievePublic(
    reference: string,
    token: string,
  ): Promise<PublicCustomerOrderDTO> {
    const result = await this.database.raw<CustomerOrderRecord>(
      "select * from customer_order where reference = ? and deleted_at is null",
      [reference],
    );
    const order = result.rows[0] ? normalizeOrder(result.rows[0]) : null;
    if (!order || !safeToken(order.access_token_hash, token))
      throw new CustomerOrderError(
        "ORDER_NOT_FOUND",
        "Pedido não encontrado",
        404,
      );
    const payment = await this.database.raw<PaymentRecord>(
      "select id, checkout_session_id, status, amount, currency, paid_at from payment_intent where id = ? and deleted_at is null",
      [order.payment_intent_id],
    );
    const tracking = await this.database.raw<{
      fulfillment_group_id: string;
      carrier: string;
      tracking_number: string;
      tracking_url: string | null;
      status: PublicCustomerOrderDTO["tracking"][number]["status"];
      updated_at: Date | string;
    }>(
      `select so.fulfillment_group_id, ft.carrier, ft.tracking_number, ft.tracking_url, ft.status, ft.updated_at
       from fulfillment_tracking ft join supplier_order so on so.id = ft.supplier_order_id
       where so.customer_order_id = ? and ft.deleted_at is null and so.deleted_at is null order by ft.created_at`,
      [order.id],
    );
    const shipping = asShipping(order.shipping_snapshot);
    return {
      reference: order.reference,
      status: order.status,
      createdAt: new Date(order.created_at).toISOString(),
      payment: {
        status: (payment.rows[0]?.status ??
          "PAID") as PublicCustomerOrderDTO["payment"]["status"],
        paidAt: payment.rows[0]?.paid_at
          ? new Date(payment.rows[0].paid_at).toISOString()
          : null,
      },
      total: money(Number(order.total_paid)),
      items: asItems(order.items_snapshot).map((item) => ({
        title: item.productTitle,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        unitPrice: money(item.unitPrice.amount),
      })),
      shipping: shipping.map((item, index) => ({
        package: `Pacote ${String(index + 1)}`,
        method: item.methodName,
        eta: `${String(item.estimatedMinimumDays)}–${String(item.estimatedMaximumDays)} dias`,
      })),
      tracking: tracking.rows.map((item, index) => ({
        package: `Pacote ${String(index + 1)}`,
        status: item.status,
        carrier: item.carrier,
        trackingNumber: item.tracking_number,
        trackingUrl: item.tracking_url,
        lastUpdatedAt: new Date(item.updated_at).toISOString(),
      })),
    };
  }

  async findByPayment(
    paymentIntentId: string,
    database = this.database,
  ): Promise<CustomerOrderRecord | null> {
    const result = await database.raw<CustomerOrderRecord>(
      "select * from customer_order where payment_intent_id = ? and deleted_at is null",
      [paymentIntentId],
    );
    return result.rows[0] ? normalizeOrder(result.rows[0]) : null;
  }

  private async cartContext(
    cartId: string,
  ): Promise<{ region_id: string; sales_channel_id: string }> {
    const remoteQuery = this.container.resolve<
      (query: object) => Promise<unknown[]>
    >(ContainerRegistrationKeys.REMOTE_QUERY);
    const query = remoteQueryObjectFromString({
      entryPoint: "cart",
      variables: { filters: { id: cartId } },
      fields: ["id", "region_id", "sales_channel_id"],
    });
    const [cart] = (await remoteQuery(query)) as Array<{
      region_id?: string;
      sales_channel_id?: string;
    }>;
    if (!cart?.region_id || !cart.sales_channel_id)
      throw new CustomerOrderError(
        "CART_CONTEXT_MISSING",
        "Contexto comercial do carrinho indisponível",
        500,
      );
    return {
      region_id: cart.region_id,
      sales_channel_id: cart.sales_channel_id,
    };
  }
}

function normalizeCheckout(
  value: CheckoutRecord | undefined,
): NormalizedCheckoutRecord | null {
  if (!value) return null;
  return {
    ...value,
    destination: parseJson<AddressSnapshot>(value.destination),
    cart_snapshot: parseJson<CartSnapshot>(value.cart_snapshot),
    selected_shipping: parseJson<{ items: ShippingSnapshot[] }>(
      value.selected_shipping,
    ),
    totals_snapshot: parseJson<{
      total: { amount: number };
      currencyCode: string;
    }>(value.totals_snapshot),
  };
}
function normalizeOrder(value: CustomerOrderRecord): CustomerOrderRecord {
  return {
    ...value,
    customer_snapshot: parseJson(value.customer_snapshot),
    address_snapshot: parseJson(value.address_snapshot),
    items_snapshot: parseJson(value.items_snapshot),
    shipping_snapshot: parseJson(value.shipping_snapshot),
  };
}
function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}
function asItems(
  value: CustomerOrderRecord["items_snapshot"],
): CartSnapshot["items"] {
  return parseJson(value);
}
function asShipping(
  value: CustomerOrderRecord["shipping_snapshot"],
): ShippingSnapshot[] {
  return parseJson(value);
}
function splitName(value: string): { first: string; last: string } {
  const [first = "Cliente", ...rest] = value.trim().split(/\s+/);
  return { first, last: rest.join(" ") || "Achilles" };
}
function secret(): string {
  return process.env.COOKIE_SECRET ?? "development_only_order_access_secret";
}
function accessToken(id: string, reference: string): string {
  return createHmac("sha256", secret())
    .update(`${id}:${reference}`)
    .digest("base64url");
}
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
function safeToken(expectedHash: string, token: string): boolean {
  const actual = Buffer.from(hashToken(token));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function money(amount: number): PublicMoneyDTO {
  return {
    amount,
    currencyCode: "brl",
    formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount),
  };
}
async function audit(
  database: OrderDatabase,
  action: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await database.raw(
    `insert into audit_event (id, action, entity_type, entity_id, actor_id, summary, before, after, metadata) values (?, ?, 'customer_order', ?, null, ?, null, null, ?::jsonb)`,
    [
      `audit_${randomUUID().replaceAll("-", "")}`,
      action,
      entityId,
      summary,
      JSON.stringify(metadata),
    ],
  );
}
function required<T>(value: T | undefined): T {
  if (!value)
    throw new CustomerOrderError(
      "ORDER_WRITE_FAILED",
      "Não foi possível salvar o pedido",
      500,
    );
  return value;
}
