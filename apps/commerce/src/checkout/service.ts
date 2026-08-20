import { createHash, randomUUID } from "node:crypto";
import type {
  BrazilCheckoutAddressDTO,
  CheckoutStatus,
  CheckoutTotalsDTO,
  DutiesMode,
  PublicCartDTO,
  PublicCheckoutDTO,
  PublicCheckoutShippingGroupDTO,
  PublicCheckoutShippingSelectionDTO,
  PublicMoneyDTO,
} from "@achilles/domain";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PublicCatalogService } from "../catalog/service";
import { PublicCartService } from "../cart/public-cart";
import { ShippingQuoteEngine } from "../shipping/engine";
import {
  checkoutAddressSchema,
  checkoutCustomerSchema,
  formatBrazilPostalCode,
} from "./brazil";
import { CheckoutReadinessPolicy } from "./readiness";
import { assertCheckoutTransition } from "./state-machine";

type QueryResult<T> = { rows: T[] };
type Database = {
  raw<T>(sql: string, bindings?: readonly unknown[]): Promise<QueryResult<T>>;
  transaction<T>(operation: (transaction: Database) => Promise<T>): Promise<T>;
};
type JsonItems<T> = { items: T[] };
type SessionRecord = {
  id: string;
  cart_id: string;
  email: string | null;
  customer_name: string | null;
  phone: string | null;
  destination: StoredAddress | null;
  shipping_groups: JsonItems<PublicCheckoutShippingGroupDTO>;
  selected_shipping: JsonItems<PublicCheckoutShippingSelectionDTO>;
  totals_snapshot: CheckoutTotalsDTO | null;
  cart_snapshot: PublicCartDTO | null;
  cart_fingerprint: string | null;
  address_fingerprint: string | null;
  status: CheckoutStatus;
  version: number;
  expires_at: Date | string;
  updated_at: Date | string;
};
type StoredAddress = Omit<BrazilCheckoutAddressDTO, "postalCodeFormatted">;
type QuoteRecord = {
  id: string;
  cart_id: string | null;
  status: string;
  expires_at: Date | string;
  duties_mode: DutiesMode;
};
type SelectionRecord = {
  shipping_group_id: string;
  shipping_quote_id: string;
  method_name: string;
  customer_price_brl: string;
  estimated_min_days: number;
  estimated_max_days: number;
  duties_mode: DutiesMode;
  expires_at: Date | string;
  cart_fingerprint: string;
  address_fingerprint: string;
};

const sessionMinutes = positiveInteger(
  process.env.CHECKOUT_SESSION_TTL_MINUTES,
  30,
);
const readiness = new CheckoutReadinessPolicy();

export class CheckoutError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export class CheckoutService {
  private readonly database: Database;
  private readonly carts: PublicCartService;
  private readonly catalog: PublicCatalogService;

  constructor(private readonly container: MedusaContainer) {
    this.database = container.resolve<Database>(
      ContainerRegistrationKeys.PG_CONNECTION,
    );
    this.carts = new PublicCartService(container);
    this.catalog = new PublicCatalogService(container);
  }

  async create(cartId: string): Promise<PublicCheckoutDTO> {
    const cart = await this.carts.retrieve(cartId);
    const id = `checkout_${randomUUID().replaceAll("-", "")}`;
    const fingerprint = cartFingerprint(cart);
    const session = await this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `cart:${cartId}`,
      ]);
      const result = await trx.raw<SessionRecord>(
        `insert into checkout_session
        (id, cart_id, status, cart_snapshot, cart_fingerprint, expires_at)
        values (?, ?, 'CART', ?::jsonb, ?, now() + (? * interval '1 minute'))
        on conflict (cart_id) where deleted_at is null do update set updated_at = now()
        returning *`,
        [id, cartId, JSON.stringify(cart), fingerprint, sessionMinutes],
      );
      const saved = requiredRow(result.rows[0]);
      if (saved.id === id)
        await audit(
          trx,
          "CHECKOUT_CREATED",
          saved.id,
          "Checkout guest criado",
          { cart_id: cartId },
        );
      return saved;
    });
    return this.present(session, cart);
  }

  async retrieve(id: string): Promise<PublicCheckoutDTO> {
    const initial = await this.getSession(id);
    const cart = await this.carts.retrieve(initial.cart_id);
    const fingerprint = cartFingerprint(cart);
    let session = initial;
    if (
      fingerprint !== initial.cart_fingerprint &&
      initial.shipping_groups.items.length
    ) {
      session = await this.invalidateShipping(
        id,
        "CART_CHANGED",
        fingerprint,
        cart,
      );
    } else if (
      initial.selected_shipping.items.some(
        (item) => new Date(item.expiresAt).getTime() <= Date.now(),
      )
    ) {
      session = await this.lockedSession(id, async (trx, locked) => {
        await this.clearShippingState(trx, locked.id, "EXPIRED_SHIPPING");
        await audit(
          trx,
          "CHECKOUT_QUOTE_EXPIRED",
          locked.id,
          "Cotação de checkout expirada",
          { reason: "EXPIRY_CHECK" },
        );
        return this.getSession(locked.id, trx);
      });
    } else if (new Date(initial.expires_at).getTime() <= Date.now()) {
      session = await this.expireSession(initial, cart, fingerprint);
    }
    return this.present(session, cart);
  }

  async updateCustomer(id: string, input: unknown): Promise<PublicCheckoutDTO> {
    const customer = checkoutCustomerSchema.parse(input);
    const session = await this.lockedSession(id, async (trx, current) => {
      const nextStatus: CheckoutStatus = ["CART", "CUSTOMER"].includes(
        current.status,
      )
        ? "CUSTOMER"
        : current.status;
      assertCheckoutTransition(current.status, nextStatus);
      const result = await trx.raw<SessionRecord>(
        `update checkout_session set
        customer_name = ?, email = ?, phone = ?, status = ?,
        version = version + 1, updated_at = now(), expires_at = now() + (? * interval '1 minute')
        where id = ? and deleted_at is null returning *`,
        [
          customer.name,
          customer.email,
          customer.phone,
          nextStatus,
          sessionMinutes,
          current.id,
        ],
      );
      return requiredRow(result.rows[0]);
    });
    return this.present(session, await this.carts.retrieve(session.cart_id));
  }

  async updateAddress(id: string, input: unknown): Promise<PublicCheckoutDTO> {
    const address = checkoutAddressSchema.parse(input);
    const stored: StoredAddress = { ...address };
    const fingerprint = addressFingerprint(stored);
    const session = await this.lockedSession(id, async (trx, current) => {
      const changed = Boolean(
        current.address_fingerprint &&
        current.address_fingerprint !== fingerprint,
      );
      if (changed) await this.deleteSelections(trx, current.id);
      const status: CheckoutStatus = changed
        ? current.shipping_groups.items.length
          ? "REQUOTE_REQUIRED"
          : "ADDRESS"
        : current.shipping_groups.items.length
          ? current.status
          : "ADDRESS";
      assertCheckoutTransition(current.status, status);
      const result = await trx.raw<SessionRecord>(
        `update checkout_session set
        destination = ?::jsonb, address_fingerprint = ?, shipping_groups = case when ? then '{"items":[]}'::jsonb else shipping_groups end,
        selected_shipping = case when ? then '{"items":[]}'::jsonb else selected_shipping end,
        totals_snapshot = case when ? then null else totals_snapshot end, status = ?, version = version + 1, updated_at = now(),
        expires_at = now() + (? * interval '1 minute') where id = ? and deleted_at is null returning *`,
        [
          JSON.stringify(stored),
          fingerprint,
          changed,
          changed,
          changed,
          status,
          sessionMinutes,
          current.id,
        ],
      );
      if (changed)
        await audit(
          trx,
          "CHECKOUT_SHIPPING_STALE",
          current.id,
          "Frete invalidado por alteração de endereço",
          { reason: "ADDRESS_CHANGED" },
        );
      return requiredRow(result.rows[0]);
    });
    return this.present(session, await this.carts.retrieve(session.cart_id));
  }

  async quoteShipping(id: string): Promise<PublicCheckoutDTO> {
    const current = await this.getSession(id);
    if (!current.destination || !current.address_fingerprint)
      throw new CheckoutError(
        "ADDRESS_REQUIRED",
        "Informe o endereço de entrega",
      );
    const cart = await this.carts.retrieve(current.cart_id);
    const cartHash = cartFingerprint(cart);
    const quote = await new ShippingQuoteEngine(
      this.container,
    ).quoteCheckoutCart({
      cartId: current.cart_id,
      postalCode: current.destination.postalCode,
      city: current.destination.city,
      state: current.destination.state,
    });
    const session = await this.lockedSession(id, async (trx, locked) => {
      if (locked.address_fingerprint !== current.address_fingerprint)
        throw new CheckoutError(
          "ADDRESS_CHANGED",
          "O endereço mudou. Atualize o frete.",
        );
      await this.deleteSelections(trx, locked.id);
      assertCheckoutTransition(locked.status, "SHIPPING");
      const result = await trx.raw<SessionRecord>(
        `update checkout_session set
        shipping_groups = ?::jsonb, selected_shipping = '{"items":[]}'::jsonb,
        totals_snapshot = null, cart_snapshot = ?::jsonb, cart_fingerprint = ?,
        status = 'SHIPPING', version = version + 1, updated_at = now(),
        expires_at = now() + (? * interval '1 minute') where id = ? and deleted_at is null returning *`,
        [
          JSON.stringify({ items: quote.groups }),
          JSON.stringify(cart),
          cartHash,
          sessionMinutes,
          locked.id,
        ],
      );
      await audit(
        trx,
        "CHECKOUT_SHIPPING_QUOTED",
        locked.id,
        "Frete do checkout cotado",
        { group_count: quote.groups.length },
      );
      return requiredRow(result.rows[0]);
    });
    return this.present(session, cart);
  }

  async selectShipping(
    id: string,
    input: { groupId: string; quoteId: string },
  ): Promise<PublicCheckoutDTO> {
    const cart = await this.carts.retrieve((await this.getSession(id)).cart_id);
    const cartHash = cartFingerprint(cart);
    const outcome = await this.lockedSession<SessionRecord | CheckoutError>(
      id,
      async (trx, current) => {
        const group = current.shipping_groups.items.find(
          (item) => item.id === input.groupId,
        );
        const method = group?.methods.find((item) => item.id === input.quoteId);
        if (!group || !method)
          throw new CheckoutError(
            "SHIPPING_METHOD_INVALID",
            "Opção de entrega inválida",
            400,
          );
        if (
          !current.address_fingerprint ||
          current.cart_fingerprint !== cartHash
        )
          throw new CheckoutError(
            "REQUOTE_REQUIRED",
            "O carrinho mudou. Atualize o frete.",
          );
        const quoteResult = await trx.raw<QuoteRecord>(
          `select id, cart_id, status, expires_at, duties_mode
        from shipping_quote where id = ? and deleted_at is null for update`,
          [input.quoteId],
        );
        const quote = quoteResult.rows[0];
        if (!quote || quote.cart_id !== current.cart_id)
          throw new CheckoutError(
            "SHIPPING_METHOD_INVALID",
            "Cotação de entrega inválida",
            400,
          );
        if (
          quote.status !== "VALID" ||
          new Date(quote.expires_at).getTime() <= Date.now()
        ) {
          await trx.raw(
            "update shipping_quote set status = 'EXPIRED', updated_at = now() where id = ?",
            [quote.id],
          );
          await audit(
            trx,
            "CHECKOUT_QUOTE_EXPIRED",
            current.id,
            "Cotação de checkout expirada",
            { quote_id: quote.id },
          );
          await this.clearShippingState(trx, current.id, "EXPIRED_SHIPPING");
          return new CheckoutError(
            "QUOTE_EXPIRED",
            "A cotação expirou. Atualize o frete.",
          );
        }
        await trx.raw(
          `insert into checkout_shipping_selection
        (id, checkout_session_id, shipping_group_id, shipping_quote_id, method_name,
        customer_price_brl, estimated_min_days, estimated_max_days, duties_mode,
        expires_at, policy_snapshot, cart_fingerprint, address_fingerprint)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
        on conflict (checkout_session_id, shipping_group_id) where deleted_at is null do update set
        shipping_quote_id = excluded.shipping_quote_id, method_name = excluded.method_name,
        customer_price_brl = excluded.customer_price_brl, estimated_min_days = excluded.estimated_min_days,
        estimated_max_days = excluded.estimated_max_days, duties_mode = excluded.duties_mode,
        expires_at = excluded.expires_at, policy_snapshot = excluded.policy_snapshot,
        cart_fingerprint = excluded.cart_fingerprint, address_fingerprint = excluded.address_fingerprint,
        updated_at = now()`,
          [
            `checkoutship_${randomUUID().replaceAll("-", "")}`,
            current.id,
            group.id,
            quote.id,
            method.name,
            method.price.amount.toFixed(2),
            method.estimatedMinimumDays,
            method.estimatedMaximumDays,
            quote.duties_mode,
            quote.expires_at,
            JSON.stringify({
              rule: "PASS_THROUGH",
              currency: "BRL",
              capturedAt: new Date().toISOString(),
            }),
            cartHash,
            current.address_fingerprint,
          ],
        );
        const selections = await this.listSelections(trx, current.id);
        const publicSelections = selections.map(
          toPublicCheckoutShippingSelection,
        );
        const totals =
          selections.length === current.shipping_groups.items.length
            ? calculateCheckoutTotals(cart, publicSelections)
            : null;
        const status: CheckoutStatus = totals ? "REVIEW" : "SHIPPING";
        assertCheckoutTransition(current.status, status);
        const updatedGroups = current.shipping_groups.items.map((item) => ({
          ...item,
          selectedMethodId:
            item.id === group.id ? method.id : item.selectedMethodId,
        }));
        const result = await trx.raw<SessionRecord>(
          `update checkout_session set
        shipping_groups = ?::jsonb, selected_shipping = ?::jsonb, totals_snapshot = ?::jsonb,
        status = ?, version = version + 1, updated_at = now() where id = ? returning *`,
          [
            JSON.stringify({ items: updatedGroups }),
            JSON.stringify({ items: publicSelections }),
            totals ? JSON.stringify(totals) : null,
            status,
            current.id,
          ],
        );
        await audit(
          trx,
          "CHECKOUT_SHIPPING_SELECTED",
          current.id,
          "Opção de entrega selecionada",
          { group_id: group.id, quote_id: quote.id },
        );
        return requiredRow(result.rows[0]);
      },
    );
    if (outcome instanceof CheckoutError) throw outcome;
    return this.present(outcome, cart);
  }

  async review(id: string): Promise<PublicCheckoutDTO> {
    const dto = await this.retrieve(id);
    const validity = await this.validateCart(dto.cart);
    if (!validity.productsPublic || !validity.pricingValid) {
      const code = validity.productsPublic
        ? "PRICE_CHANGED"
        : "PRODUCT_NOT_PUBLIC";
      await this.markBlocked(id, code);
      throw new CheckoutError(
        code,
        validity.productsPublic
          ? "O preço de um item foi atualizado. Revise o carrinho."
          : "Um item do seu carrinho não está mais disponível.",
      );
    }
    if (!dto.readiness.ready)
      throw new CheckoutError(
        "CHECKOUT_NOT_READY",
        "Revise os dados do checkout antes de continuar",
      );
    return dto;
  }

  async markReady(id: string): Promise<PublicCheckoutDTO> {
    await this.review(id);
    const session = await this.lockedSession(id, async (trx, current) => {
      assertCheckoutTransition(current.status, "READY_FOR_PAYMENT");
      const result = await trx.raw<SessionRecord>(
        `update checkout_session set status = 'READY_FOR_PAYMENT',
        ready_at = now(), version = version + 1, updated_at = now() where id = ? returning *`,
        [current.id],
      );
      await audit(
        trx,
        "CHECKOUT_READY",
        current.id,
        "Checkout pronto para futura etapa de pagamento",
        null,
      );
      return requiredRow(result.rows[0]);
    });
    return this.present(session, await this.carts.retrieve(session.cart_id));
  }

  private async present(
    session: SessionRecord,
    cart: PublicCartDTO,
  ): Promise<PublicCheckoutDTO> {
    const selections = session.selected_shipping.items;
    const current = selections.every(
      (item) => new Date(item.expiresAt).getTime() > Date.now(),
    );
    const address = session.destination
      ? {
          ...session.destination,
          postalCodeFormatted: formatBrazilPostalCode(
            session.destination.postalCode,
          ),
        }
      : null;
    const validity = await this.validateCart(cart);
    const assessment = readiness.assess({
      cartValid: cart.items.length > 0,
      productsPublic: validity.productsPublic,
      pricingValid: validity.pricingValid,
      addressValid: Boolean(address),
      groupCount: session.shipping_groups.items.length,
      selectionCount: selections.length,
      selectionsCurrent:
        current &&
        selections.every(
          (item) => item.groupId && item.quoteId && item.expiresAt,
        ),
      totalsCalculated: Boolean(session.totals_snapshot),
      blocked: session.status === "BLOCKED",
      taxesKnown: session.totals_snapshot?.taxes.known ?? false,
      allowUnknownTaxes: false,
    });
    return {
      id: session.id,
      cartId: session.cart_id,
      status: session.status,
      customer:
        session.customer_name && session.email && session.phone
          ? {
              name: session.customer_name,
              email: session.email,
              phone: session.phone,
            }
          : null,
      address,
      cart,
      shippingGroups: session.shipping_groups.items,
      shippingSelections: selections,
      shipmentType:
        session.shipping_groups.items.length > 1 ? "MULTI_SHIPMENT" : "SINGLE",
      totals: session.totals_snapshot,
      readiness: assessment,
      expiresAt: iso(session.expires_at),
      updatedAt: iso(session.updated_at),
      notice: noticeFor(session.status),
    };
  }

  private async validateCart(
    cart: PublicCartDTO,
  ): Promise<{ productsPublic: boolean; pricingValid: boolean }> {
    let productsPublic = true;
    let pricingValid = true;
    for (const item of cart.items) {
      const product = await this.catalog.getProductByVariantId(item.variantId);
      const variant = product?.variants.find(
        (candidate) => candidate.id === item.variantId,
      );
      if (!product || !variant || !product.available || !variant.available)
        productsPublic = false;
      else if (variant.price.amount !== item.unitPrice.amount)
        pricingValid = false;
    }
    return { productsPublic, pricingValid };
  }

  private async getSession(
    id: string,
    database = this.database,
  ): Promise<SessionRecord> {
    const result = await database.raw<SessionRecord>(
      "select * from checkout_session where id = ? and deleted_at is null",
      [id],
    );
    if (!result.rows[0])
      throw new CheckoutError(
        "CHECKOUT_NOT_FOUND",
        "Checkout não encontrado",
        404,
      );
    return normalizeSession(result.rows[0]);
  }

  private async lockedSession<T>(
    id: string,
    operation: (trx: Database, session: SessionRecord) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `checkout:${id}`,
      ]);
      return operation(trx, await this.getSession(id, trx));
    });
  }

  private async listSelections(
    database: Database,
    id: string,
  ): Promise<SelectionRecord[]> {
    const result = await database.raw<SelectionRecord>(
      `select * from checkout_shipping_selection
      where checkout_session_id = ? and deleted_at is null order by shipping_group_id`,
      [id],
    );
    return result.rows;
  }

  private async deleteSelections(
    database: Database,
    id: string,
  ): Promise<void> {
    await database.raw(
      "delete from checkout_shipping_selection where checkout_session_id = ?",
      [id],
    );
  }

  private async clearShippingState(
    database: Database,
    id: string,
    status: CheckoutStatus,
  ): Promise<void> {
    await this.deleteSelections(database, id);
    await database.raw(
      `update checkout_session set shipping_groups = '{"items":[]}'::jsonb,
      selected_shipping = '{"items":[]}'::jsonb, totals_snapshot = null, status = ?,
      version = version + 1, updated_at = now() where id = ?`,
      [status, id],
    );
  }

  private async invalidateShipping(
    id: string,
    reason: string,
    fingerprint: string,
    cart: PublicCartDTO,
  ): Promise<SessionRecord> {
    return this.lockedSession(id, async (trx, current) => {
      await this.clearShippingState(trx, current.id, "REQUOTE_REQUIRED");
      const result = await trx.raw<SessionRecord>(
        `update checkout_session set cart_fingerprint = ?, cart_snapshot = ?::jsonb
        where id = ? returning *`,
        [fingerprint, JSON.stringify(cart), current.id],
      );
      await audit(
        trx,
        "CHECKOUT_SHIPPING_STALE",
        current.id,
        "Frete invalidado",
        { reason },
      );
      return requiredRow(result.rows[0]);
    });
  }

  private async expireSession(
    current: SessionRecord,
    cart: PublicCartDTO,
    fingerprint: string,
  ): Promise<SessionRecord> {
    return this.lockedSession(current.id, async (trx, locked) => {
      await this.deleteSelections(trx, locked.id);
      const status: CheckoutStatus = locked.shipping_groups.items.length
        ? "EXPIRED_SHIPPING"
        : locked.destination
          ? "ADDRESS"
          : locked.email
            ? "CUSTOMER"
            : "CART";
      const result = await trx.raw<SessionRecord>(
        `update checkout_session set shipping_groups = '{"items":[]}'::jsonb,
        selected_shipping = '{"items":[]}'::jsonb, totals_snapshot = null, status = ?,
        cart_fingerprint = ?, cart_snapshot = ?::jsonb, expires_at = now() + (? * interval '1 minute'),
        version = version + 1, updated_at = now() where id = ? returning *`,
        [status, fingerprint, JSON.stringify(cart), sessionMinutes, locked.id],
      );
      await audit(
        trx,
        "CHECKOUT_SESSION_EXPIRED",
        locked.id,
        "Sessão retomada com frete invalidado",
        null,
      );
      return requiredRow(result.rows[0]);
    });
  }

  private async markBlocked(id: string, reason: string): Promise<void> {
    await this.lockedSession(id, async (trx, current) => {
      await this.clearShippingState(trx, current.id, "BLOCKED");
      await audit(
        trx,
        "CHECKOUT_BLOCKED",
        current.id,
        "Checkout bloqueado por validação comercial",
        { reason },
      );
    });
  }
}

function normalizeSession(value: SessionRecord): SessionRecord {
  return {
    ...value,
    shipping_groups: jsonItems(value.shipping_groups),
    selected_shipping: jsonItems(value.selected_shipping),
  };
}

function jsonItems<T>(value: JsonItems<T> | null): JsonItems<T> {
  return value && Array.isArray(value.items) ? value : { items: [] };
}

function cartFingerprint(cart: PublicCartDTO): string {
  return hash(
    JSON.stringify(
      cart.items.map((item) => [
        item.id,
        item.variantId,
        item.quantity,
        item.unitPrice.amount,
      ]),
    ),
  );
}

function addressFingerprint(address: StoredAddress): string {
  return hash(
    [
      address.postalCode,
      address.city.trim().toLocaleLowerCase("pt-BR"),
      address.state,
    ].join("|"),
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function calculateCheckoutTotals(
  cart: PublicCartDTO,
  selections: readonly PublicCheckoutShippingSelectionDTO[],
): CheckoutTotalsDTO {
  const shippingAmount = selections.reduce(
    (sum, item) => sum + item.price.amount,
    0,
  );
  const ddpConfirmed =
    selections.length > 0 &&
    selections.every((item) => item.dutiesMode === "DDP");
  return {
    products: money(cart.subtotal.amount),
    shippingByGroup: selections.map((item) => ({
      groupId: item.groupId,
      amount: money(item.price.amount),
    })),
    shipping: money(shippingAmount),
    discounts: money(0),
    taxes: ddpConfirmed
      ? { known: true, amount: null, label: "Incluídos na entrega DDP" }
      : { known: false, amount: null, label: "Não determinado" },
    fulfillmentTaxMode: ddpConfirmed ? "DDP_CONFIRMED" : "UNKNOWN",
    total: money(cart.subtotal.amount + shippingAmount),
    currencyCode: "brl",
    capturedAt: new Date().toISOString(),
  };
}

export function toPublicCheckoutShippingSelection(
  value: SelectionRecord,
): PublicCheckoutShippingSelectionDTO {
  return {
    groupId: value.shipping_group_id,
    quoteId: value.shipping_quote_id,
    methodName: value.method_name,
    price: money(Number(value.customer_price_brl)),
    estimatedMinimumDays: value.estimated_min_days,
    estimatedMaximumDays: value.estimated_max_days,
    dutiesMode: value.duties_mode,
    dutiesNotice: dutiesNotice(value.duties_mode),
    expiresAt: iso(value.expires_at),
  };
}

function money(amount: number): PublicMoneyDTO {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return {
    amount: rounded,
    currencyCode: "brl",
    formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(rounded),
  };
}

function dutiesNotice(mode: DutiesMode): string {
  if (mode === "DDP")
    return "Tributos de importação incluídos na modalidade de entrega.";
  if (mode === "DAP")
    return "Encargos de importação podem ser cobrados no destino.";
  return "Tributos de importação ainda não foram determinados.";
}

function noticeFor(status: CheckoutStatus): string | null {
  if (status === "EXPIRED_SHIPPING")
    return "Sua cotação expirou. Atualize o frete.";
  if (status === "REQUOTE_REQUIRED")
    return "As opções de entrega precisam ser atualizadas.";
  if (status === "READY_FOR_PAYMENT")
    return "Checkout pronto para escolher o pagamento.";
  if (status === "PAYMENT_PENDING")
    return "Aguardando confirmação do pagamento.";
  if (status === "PAID") return "Pagamento confirmado.";
  if (status === "PAYMENT_FAILED")
    return "Pagamento não aprovado. Você pode tentar novamente.";
  if (status === "BLOCKED")
    return "Revise os itens do carrinho para continuar.";
  return null;
}

async function audit(
  database: Database,
  action: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  await database.raw(
    `insert into audit_event (id, action, entity_type, entity_id, actor_id, summary, before, after, metadata)
    values (?, ?, 'checkout_session', ?, null, ?, null, null, ?::jsonb)`,
    [
      `audit_${randomUUID().replaceAll("-", "")}`,
      action,
      entityId,
      summary,
      JSON.stringify(metadata),
    ],
  );
}

function requiredRow(value: SessionRecord | undefined): SessionRecord {
  if (!value)
    throw new CheckoutError(
      "CHECKOUT_WRITE_FAILED",
      "Não foi possível atualizar o checkout",
      500,
    );
  return normalizeSession(value);
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
