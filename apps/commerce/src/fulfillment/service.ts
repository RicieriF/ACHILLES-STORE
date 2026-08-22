import { createHash, randomUUID } from "node:crypto";
import type { RoutingSnapshot, SupplierGateStatus } from "@achilles/domain";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { SupplierMarginProtection } from "./margin-protection";
import { emitFulfillmentEvent } from "./events";
import { supplierOrderProvider } from "./providers";
import { SupplierOrderGate } from "./supplier-order-gate";
import type { OrderDatabase } from "../orders/customer-order-service";

type OrderRow = {
  id: string;
  reference: string;
  payment_intent_id: string;
  checkout_session_id: string;
  status: string;
  total_paid: string;
  currency: string;
  address_snapshot: Address | string;
  items_snapshot: Item[] | string;
  shipping_snapshot: Selection[] | string;
};
type Address = {
  street: string;
  number: string;
  complement: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: "BR";
};
type Item = {
  productTitle: string;
  variantTitle: string;
  variantId: string;
  quantity: number;
  unitPrice: { amount: number };
};
type Selection = {
  groupId: string;
  quoteId: string;
  methodName: string;
  price: { amount: number };
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
  dutiesMode?: string;
};
type RouteRow = {
  quote_id: string;
  quote_status: string;
  quote_expires_at: Date | string;
  variant_id: string;
  quantity: number;
  provider_amount: string;
  normalized_amount_brl: string | null;
  estimated_min_days: number;
  estimated_max_days: number;
  method_name: string;
  supplier_offer_id: string;
  supplier_id: string;
  supplier_provider: string;
  supplier_status: string;
  supplier_country_code: string;
  offer_status: string;
  availability: string;
  availability_quantity: number | null;
  currency: string;
  unit_cost: string;
  fulfillment_mode:
    "PRIVATE_LABEL_DROPSHIP" | "GENERIC_DROPSHIP" | "BRAZIL_STOCK";
  private_label_supported: boolean;
  branding_moq: number | null;
  branding_profile_id: string | null;
  supplier_sku: string | null;
  product_id: string;
  compliance_status: string | null;
  fx_rate: string | null;
};
type PlanRow = {
  id: string;
  customer_order_id: string;
  status: SupplierGateStatus;
  version: number;
  revenue_brl: string;
  approved_margin_brl: string | null;
  approved_at: Date | string | null;
  approved_by: string | null;
  approval_snapshot: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};
type ShippingQuoteSnapshot = {
  quoteId: string;
  providerAmount: string;
  normalizedAmountBrl: string | null;
  method: string;
  expiresAt: string;
  status: string;
  eta: { minimumDays: number; maximumDays: number };
};
type GroupRow = {
  id: string;
  plan_id: string;
  supplier_id: string;
  supplier_offer_id: string;
  provider: string;
  fulfillment_mode: RouteRow["fulfillment_mode"];
  items_snapshot: Item[] | string;
  shipping_quote_snapshot: ShippingQuoteSnapshot | string;
  routing_snapshot: RoutingSnapshot | string;
  approval_fingerprint: string | null;
};

export class FulfillmentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "FulfillmentError";
  }
}

export class FulfillmentService {
  private readonly database: OrderDatabase;
  private readonly gate = new SupplierOrderGate();
  private readonly margin = new SupplierMarginProtection();
  constructor(private readonly container: MedusaContainer) {
    this.database = container.resolve<OrderDatabase>(
      ContainerRegistrationKeys.PG_CONNECTION,
    );
  }

  async ensurePlan(customerOrderId: string): Promise<PlanRow> {
    return this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `supplier-plan:${customerOrderId}`,
      ]);
      const prior = await this.getPlan(customerOrderId, trx);
      if (prior) return prior;
      const order = await this.getOrder(customerOrderId, trx);
      const routes = await this.routesForOrder(order, trx);
      if (!routes.length)
        throw new FulfillmentError(
          "ROUTING_MISSING",
          "Não foi possível criar o plano de fulfillment",
          500,
        );
      const planId = `supplan_${randomUUID().replaceAll("-", "")}`;
      const plan = await trx.raw<PlanRow>(
        `insert into supplier_fulfillment_plan (id, customer_order_id, status, version, revenue_brl)
         values (?, ?, 'NOT_READY', 1, ?) returning *`,
        [planId, order.id, order.total_paid],
      );
      for (const route of routes) {
        const item = asItems(order.items_snapshot).find(
          (candidate) => candidate.variantId === route.variant_id,
        );
        if (!item)
          throw new FulfillmentError(
            "ROUTING_ITEM_MISSING",
            "Item do fulfillment não encontrado",
            500,
          );
        const sourceTotal = Number(route.unit_cost) * item.quantity;
        const productCostBrl = route.fx_rate
          ? sourceTotal * Number(route.fx_rate)
          : null;
        const shippingCost = route.normalized_amount_brl;
        const delivered =
          productCostBrl === null || shippingCost === null
            ? null
            : productCostBrl + Number(shippingCost);
        const snapshot: RoutingSnapshot = {
          offerId: route.supplier_offer_id,
          supplierId: route.supplier_id,
          provider: route.supplier_provider,
          inventoryStatus: route.availability,
          sourceCost: sourceTotal.toFixed(2),
          shippingCost: route.provider_amount,
          deliveredCost: delivered?.toFixed(2) ?? "UNKNOWN",
          currency: route.currency,
          eta: {
            minimumDays: route.estimated_min_days,
            maximumDays: route.estimated_max_days,
          },
          compatibility: {
            fulfillmentMode: route.fulfillment_mode,
            privateLabel: route.private_label_supported,
            compliance: route.compliance_status ?? "PENDING",
          },
          score: null,
          reasons: routingReasons(route),
          capturedAt: new Date().toISOString(),
        };
        await trx.raw(
          `insert into supplier_fulfillment_group (id, plan_id, supplier_id, supplier_offer_id, provider, fulfillment_mode, items_snapshot, shipping_quote_snapshot, routing_snapshot)
           values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)`,
          [
            `fulgrp_${randomUUID().replaceAll("-", "")}`,
            planId,
            route.supplier_id,
            route.supplier_offer_id,
            route.supplier_provider,
            route.fulfillment_mode,
            JSON.stringify([item]),
            JSON.stringify({
              quoteId: route.quote_id,
              providerAmount: route.provider_amount,
              normalizedAmountBrl: route.normalized_amount_brl,
              method: route.method_name,
              expiresAt: new Date(route.quote_expires_at).toISOString(),
              status: route.quote_status,
              eta: {
                minimumDays: route.estimated_min_days,
                maximumDays: route.estimated_max_days,
              },
            }),
            JSON.stringify(snapshot),
          ],
        );
      }
      const assessment = await this.assess(order.id, trx);
      await trx.raw(
        "update supplier_fulfillment_plan set status = ?, updated_at = now() where id = ?",
        [assessment.status, planId],
      );
      await trx.raw(
        "update customer_order set status = ?, updated_at = now() where id = ?",
        [
          assessment.status === "APPROVAL_REQUIRED"
            ? "SUPPLIER_APPROVAL_REQUIRED"
            : assessment.status === "BLOCKED"
              ? "EXCEPTION"
              : "FULFILLMENT_REVIEW",
          order.id,
        ],
      );
      await audit(
        trx,
        "SUPPLIER_PLAN_CREATED",
        planId,
        "Supplier Fulfillment Plan criado",
        {
          customer_order_id: order.id,
          group_count: routes.length,
          gate_status: assessment.status,
          reasons: assessment.reasons,
        },
      );
      await emitFulfillmentEvent(this.container, "supplier_plan.created", {
        customer_order_id: order.id,
        supplier_plan_id: planId,
      });
      if (assessment.status === "BLOCKED")
        await emitFulfillmentEvent(this.container, "supplier_gate.blocked", {
          customer_order_id: order.id,
          reasons: assessment.reasons,
        });
      return required(plan.rows[0]);
    });
  }

  async assess(
    customerOrderId: string,
    database = this.database,
  ): Promise<{
    status: SupplierGateStatus;
    reasons: readonly string[];
    margin: ReturnType<SupplierMarginProtection["assess"]>;
    changes: Array<Record<string, unknown>>;
  }> {
    const order = await this.getOrder(customerOrderId, database);
    const plan = await this.getPlan(customerOrderId, database);
    const groups = plan ? await this.groups(plan.id, database) : [];
    const payment = await database.raw<{ status: string }>(
      "select status from payment_intent where id = ? and deleted_at is null",
      [order.payment_intent_id],
    );
    let productCost = 0;
    let shippingCost = 0;
    let costsKnown = true;
    let productsValid = true;
    let complianceAllowed = true;
    let offerActive = true;
    let supplierActive = true;
    let available = true;
    let quantityValid = true;
    let costsCurrent = true;
    let shippingCurrent = true;
    let privateLabelReady = true;
    const changes: Array<Record<string, unknown>> = [];
    for (const group of groups) {
      const snapshot = parseJson<RoutingSnapshot>(group.routing_snapshot);
      const current = await this.currentRoute(group, database);
      if (!current) {
        offerActive = false;
        continue;
      }
      offerActive &&= current.offer_status === "ACTIVE";
      supplierActive &&= current.supplier_status === "ACTIVE";
      available &&= current.availability !== "OUT_OF_STOCK";
      const requested = asItems(group.items_snapshot).reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      quantityValid &&=
        current.availability_quantity === null ||
        current.availability_quantity >= requested;
      productsValid &&= Boolean(current.product_id && current.variant_id);
      complianceAllowed &&= current.compliance_status === "CLEAR";
      const currentSourceCost = (Number(current.unit_cost) * requested).toFixed(
        2,
      );
      const currentShipping = current.provider_amount;
      if (currentSourceCost !== snapshot.sourceCost) {
        costsCurrent = false;
        changes.push({
          type: "PRICE_CHANGED",
          original: snapshot.sourceCost,
          current: currentSourceCost,
          currency: current.currency,
        });
      }
      if (currentShipping !== snapshot.shippingCost) {
        shippingCurrent = false;
        changes.push({
          type: "SHIPPING_CHANGED",
          original: snapshot.shippingCost,
          current: currentShipping,
          currency: current.currency,
        });
      }
      const currentProductBrl = current.fx_rate
        ? Number(currentSourceCost) * Number(current.fx_rate)
        : null;
      if (currentProductBrl === null || current.normalized_amount_brl === null)
        costsKnown = false;
      else {
        productCost += currentProductBrl;
        shippingCost += Number(current.normalized_amount_brl);
      }
      if (current.fulfillment_mode === "PRIVATE_LABEL_DROPSHIP") {
        privateLabelReady &&=
          current.private_label_supported &&
          Boolean(current.branding_profile_id) &&
          (current.branding_moq === null || requested >= current.branding_moq);
      }
    }
    const revenue = Number(order.total_paid);
    const fees = configuredPercent("SUPPLIER_PAYMENT_FEE_PERCENT", 5, revenue);
    const reserves = configuredPercent(
      "SUPPLIER_RISK_RESERVE_PERCENT",
      5,
      revenue,
    );
    const margin = this.margin.assess({
      revenue: order.total_paid,
      productCost: costsKnown ? productCost.toFixed(2) : null,
      shippingCost: costsKnown ? shippingCost.toFixed(2) : null,
      paymentFees: fees.toFixed(2),
      reserves: reserves.toFixed(2),
      minimumMarginPercent: configuredNumber("SUPPLIER_MIN_MARGIN_PERCENT", 10),
    });
    const duplicates = await database.raw<{ count: string }>(
      `select count(*)::text as count from supplier_order where customer_order_id = ? and deleted_at is null and status not in ('REJECTED','CANCELLED','FAILED')`,
      [order.id],
    );
    const decision = this.gate.evaluate({
      customerOrderExists: true,
      paymentStatus: payment.rows[0]?.status ?? "UNKNOWN",
      paymentRefundedOrCancelled: ["REFUNDED", "CANCELLED"].includes(
        payment.rows[0]?.status ?? "",
      ),
      productsValid,
      complianceAllowed,
      offerActive,
      supplierActive,
      available,
      quantityValid,
      costsCurrent,
      shippingCurrent,
      addressValid: validAddress(parseJson<Address>(order.address_snapshot)),
      shippingMethodValid:
        asShipping(order.shipping_snapshot).length === groups.length,
      providerHealth: "HEALTHY",
      fulfillmentCapable: true,
      duplicateSupplierOrder:
        Number(duplicates.rows[0]?.count ?? 0) > 0 &&
        plan?.status !== "APPROVED",
      privateLabelReady,
      importerIdentityReady: true,
      approvalFingerprintCurrent: plan?.approved_at
        ? await this.fingerprint(groups, database).then(
            (value) => value === approvalFingerprint(plan.approval_snapshot),
          )
        : true,
      margin,
    });
    return { ...decision, margin, changes };
  }

  async approve(
    customerOrderId: string,
    approver: string,
  ): Promise<Record<string, unknown>> {
    return this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `supplier-approval:${customerOrderId}`,
      ]);
      const order = await this.getOrder(customerOrderId, trx);
      const plan = await this.getPlan(customerOrderId, trx);
      if (!plan)
        throw new FulfillmentError(
          "PLAN_NOT_FOUND",
          "Plano não encontrado",
          404,
        );
      const assessment = await this.assess(customerOrderId, trx);
      if (assessment.status !== "APPROVAL_REQUIRED") {
        await this.persistExceptions(order.id, assessment, trx);
        throw new FulfillmentError(
          "GATE_NOT_APPROVABLE",
          `Gate não permite aprovação: ${assessment.reasons.join(", ")}`,
        );
      }
      const groups = await this.groups(plan.id, trx);
      const fingerprint = await this.fingerprint(groups, trx);
      const snapshot = {
        fingerprint,
        groups: groups.map((group) => ({
          id: group.id,
          supplierId: group.supplier_id,
          supplierOfferId: group.supplier_offer_id,
          items: parseJson(group.items_snapshot),
          routing: parseJson(group.routing_snapshot),
          shipping: parseJson(group.shipping_quote_snapshot),
        })),
        margin: assessment.margin,
        addressFingerprint: addressHash(
          parseJson<Address>(order.address_snapshot),
        ),
        approvedAt: new Date().toISOString(),
        approver,
      };
      await trx.raw(
        `update supplier_fulfillment_plan set status = 'APPROVED', version = version + 1, approved_at = now(), approved_by = ?, approved_margin_brl = ?, approval_snapshot = ?::jsonb, updated_at = now() where id = ?`,
        [approver, assessment.margin.margin, JSON.stringify(snapshot), plan.id],
      );
      for (const group of groups) {
        await trx.raw(
          "update supplier_fulfillment_group set approval_fingerprint = ?, updated_at = now() where id = ?",
          [fingerprint, group.id],
        );
        const route = parseJson<RoutingSnapshot>(group.routing_snapshot);
        const shipping = parseJson<ShippingQuoteSnapshot>(
          group.shipping_quote_snapshot,
        );
        const productCost =
          route.deliveredCost === "UNKNOWN" ||
          shipping.normalizedAmountBrl === null
            ? null
            : Number(route.deliveredCost) -
              Number(shipping.normalizedAmountBrl);
        await trx.raw(
          `insert into supplier_order (id, customer_order_id, fulfillment_group_id, supplier_id, supplier_offer_id, provider, status, currency, expected_product_cost, expected_shipping_cost, expected_total, sandbox, approved_by, approved_at)
           values (?, ?, ?, ?, ?, 'TEST', 'APPROVED', 'BRL', ?, ?, ?, true, ?, now())
           on conflict do nothing`,
          [
            `supord_${randomUUID().replaceAll("-", "")}`,
            order.id,
            group.id,
            group.supplier_id,
            group.supplier_offer_id,
            productCost?.toFixed(2) ?? "UNKNOWN",
            shipping.normalizedAmountBrl ?? "UNKNOWN",
            route.deliveredCost,
            approver,
          ],
        );
      }
      await trx.raw(
        "update customer_order set status = 'SUPPLIER_APPROVED', updated_at = now() where id = ?",
        [order.id],
      );
      await audit(
        trx,
        "SUPPLIER_GATE_APPROVED",
        plan.id,
        "Pedido ao fornecedor aprovado para sandbox",
        { approver, sandbox_only: true, fingerprint },
      );
      await emitFulfillmentEvent(this.container, "supplier_gate.approved", {
        customer_order_id: order.id,
        supplier_plan_id: plan.id,
        sandbox_only: true,
      });
      return snapshot;
    });
  }

  async executeSandbox(customerOrderId: string): Promise<void> {
    const order = await this.getOrder(customerOrderId);
    const plan = await this.getPlan(customerOrderId);
    if (!plan || plan.status !== "APPROVED")
      throw new FulfillmentError(
        "APPROVAL_REQUIRED",
        "Aprovação humana obrigatória",
      );
    const current = await this.assess(customerOrderId);
    if (current.status === "STALE" || current.changes.length)
      throw new FulfillmentError(
        "APPROVAL_STALE",
        "Dados mudaram após a aprovação; nova aprovação necessária",
      );
    const supplierOrders = await this.database.raw<{
      id: string;
      fulfillment_group_id: string;
      provider: string;
      status: string;
      expected_total: string;
    }>(
      "select id, fulfillment_group_id, provider, status, expected_total from supplier_order where customer_order_id = ? and deleted_at is null order by created_at",
      [customerOrderId],
    );
    for (const supplierOrder of supplierOrders.rows) {
      if (supplierOrder.provider !== "TEST")
        throw new FulfillmentError(
          "REAL_PROVIDER_DISABLED",
          "Execução real desativada.",
        );
      if (
        ["SUBMITTED", "CONFIRMED", "SHIPPED", "DELIVERED"].includes(
          supplierOrder.status,
        )
      )
        continue;
      const group = (await this.groups(plan.id)).find(
        (candidate) => candidate.id === supplierOrder.fulfillment_group_id,
      );
      const items = group ? asItems(group.items_snapshot) : [];
      const recipient = sanitizeRecipientForSandbox(
        parseJson<Address>(order.address_snapshot),
      );
      const provider = supplierOrderProvider("TEST");
      await this.database.raw(
        "update supplier_order set status = 'SUBMITTING', updated_at = now() where id = ?",
        [supplierOrder.id],
      );
      const result = await provider.createOrder({
        idempotencyKey: `sandbox:${supplierOrder.id}`,
        supplierOrderId: supplierOrder.id,
        recipient,
        currency: "BRL",
        expectedTotal: supplierOrder.expected_total,
        items: items.map((item) => ({
          supplierSku: `TEST-${item.variantId}`,
          quantity: item.quantity,
        })),
        scenario: "tracking_available",
      });
      await this.database.raw(
        `update supplier_order set provider_order_id = ?, status = ?, submitted_at = now(), confirmed_at = case when ? = 'CONFIRMED' then now() else confirmed_at end, updated_at = now() where id = ?`,
        [
          result.providerOrderId,
          result.status,
          result.status,
          supplierOrder.id,
        ],
      );
      const tracking = await provider.getTracking(result.providerOrderId);
      if (tracking)
        await this.database.raw(
          `insert into fulfillment_tracking (id, supplier_order_id, carrier, tracking_number, tracking_url, status, provider, sandbox, last_event_at)
           values (?, ?, ?, ?, null, ?, 'TEST', true, now()) on conflict (supplier_order_id) where deleted_at is null do update set status = excluded.status, last_event_at = now(), updated_at = now()`,
          [
            `track_${randomUUID().replaceAll("-", "")}`,
            supplierOrder.id,
            tracking.carrier,
            tracking.trackingNumber,
            tracking.status,
          ],
        );
      await audit(
        this.database,
        "SUPPLIER_ORDER_CREATED",
        supplierOrder.id,
        "Supplier Order criado no sandbox",
        { sandbox: true, provider_order_id: result.providerOrderId },
      );
      await emitFulfillmentEvent(this.container, "supplier_order.created", {
        customer_order_id: order.id,
        supplier_order_id: supplierOrder.id,
        sandbox: true,
      });
      if (result.status === "CONFIRMED")
        await emitFulfillmentEvent(this.container, "supplier_order.confirmed", {
          customer_order_id: order.id,
          supplier_order_id: supplierOrder.id,
          sandbox: true,
        });
    }
    await this.database.raw(
      "update customer_order set status = 'SUPPLIER_CONFIRMED', updated_at = now() where id = ?",
      [customerOrderId],
    );
  }

  async advanceSandbox(
    customerOrderId: string,
    status: "SHIPPED" | "DELIVERED",
  ): Promise<void> {
    const order = await this.getOrder(customerOrderId);
    const supplierOrders = await this.database.raw<{
      id: string;
      sandbox: boolean;
      status: string;
    }>(
      "select id, sandbox, status from supplier_order where customer_order_id = ? and deleted_at is null",
      [customerOrderId],
    );
    if (
      !supplierOrders.rows.length ||
      supplierOrders.rows.some((item) => !item.sandbox)
    )
      throw new FulfillmentError(
        "SANDBOX_ORDER_REQUIRED",
        "Supplier Order sandbox necessário",
      );
    const trackingStatus = status === "SHIPPED" ? "IN_TRANSIT" : "DELIVERED";
    for (const supplierOrder of supplierOrders.rows) {
      await this.database.raw(
        `update supplier_order set status = ?, shipped_at = case when ? = 'SHIPPED' then coalesce(shipped_at, now()) else shipped_at end, delivered_at = case when ? = 'DELIVERED' then now() else delivered_at end, updated_at = now() where id = ?`,
        [status, status, status, supplierOrder.id],
      );
      await this.database.raw(
        "update fulfillment_tracking set status = ?, last_event_at = now(), updated_at = now() where supplier_order_id = ? and deleted_at is null",
        [trackingStatus, supplierOrder.id],
      );
    }
    await this.database.raw(
      "update customer_order set status = ?, updated_at = now() where id = ?",
      [status, order.id],
    );
    await audit(
      this.database,
      status === "SHIPPED" ? "FULFILLMENT_SHIPPED" : "FULFILLMENT_DELIVERED",
      order.id,
      `Fulfillment sandbox ${status.toLowerCase()}`,
      { sandbox: true },
    );
    await emitFulfillmentEvent(
      this.container,
      status === "SHIPPED" ? "fulfillment.shipped" : "fulfillment.delivered",
      { customer_order_id: order.id, sandbox: true },
    );
  }

  async registerTracking(
    customerOrderId: string,
    input: {
      carrier: string;
      trackingNumber: string;
      trackingUrl: string | null;
    },
    actorId: string | null,
  ): Promise<void> {
    const carrier = input.carrier.trim();
    const trackingNumber = input.trackingNumber.trim();
    const trackingUrl = input.trackingUrl?.trim() || null;
    if (carrier.length < 2)
      throw new FulfillmentError(
        "CARRIER_REQUIRED",
        "Informe a transportadora",
        400,
      );
    if (trackingNumber.length < 4)
      throw new FulfillmentError(
        "TRACKING_REQUIRED",
        "Informe o código de rastreio",
        400,
      );
    if (
      /^TEST(?:-|$)/i.test(trackingNumber) ||
      trackingNumber.toUpperCase() === "TEST"
    )
      throw new FulfillmentError(
        "TEST_TRACKING_FORBIDDEN",
        "Não use código de teste em rastreio real",
        400,
      );
    const order = await this.getOrder(customerOrderId);
    const plan = await this.getPlan(customerOrderId);
    if (!plan || plan.status !== "APPROVED")
      throw new FulfillmentError(
        "APPROVAL_REQUIRED",
        "Aprove o pedido ao fornecedor antes de registrar o rastreio",
      );
    const supplierOrders = await this.database.raw<{
      id: string;
      provider: string;
    }>(
      "select id, provider from supplier_order where customer_order_id = ? and deleted_at is null order by created_at",
      [customerOrderId],
    );
    const supplierOrder = supplierOrders.rows[0];
    if (!supplierOrder)
      throw new FulfillmentError(
        "SUPPLIER_ORDER_REQUIRED",
        "Pedido ao fornecedor ainda não foi criado",
      );
    await this.database.raw(
      `insert into fulfillment_tracking (id, supplier_order_id, carrier, tracking_number, tracking_url, status, provider, sandbox, last_event_at)
       values (?, ?, ?, ?, ?, 'IN_TRANSIT', ?, false, now())
       on conflict (supplier_order_id) where deleted_at is null do update set
         carrier = excluded.carrier,
         tracking_number = excluded.tracking_number,
         tracking_url = excluded.tracking_url,
         status = 'IN_TRANSIT',
         sandbox = false,
         last_event_at = now(),
         updated_at = now()`,
      [
        `track_${randomUUID().replaceAll("-", "")}`,
        supplierOrder.id,
        carrier,
        trackingNumber,
        trackingUrl,
        supplierOrder.provider,
      ],
    );
    await this.database.raw(
      "update supplier_order set status = 'SHIPPED', shipped_at = coalesce(shipped_at, now()), updated_at = now() where id = ?",
      [supplierOrder.id],
    );
    await this.database.raw(
      "update customer_order set status = 'SHIPPED', updated_at = now() where id = ?",
      [order.id],
    );
    await audit(
      this.database,
      "FULFILLMENT_TRACKING_REGISTERED",
      order.id,
      `Rastreio ${trackingNumber} registrado`,
      {
        actor_id: actorId,
        sandbox: false,
        carrier,
        tracking_number: trackingNumber,
      },
    );
    await emitFulfillmentEvent(this.container, "fulfillment.shipped", {
      customer_order_id: order.id,
      sandbox: false,
    });
  }

  async listAdmin(): Promise<Record<string, unknown>[]> {
    const result = await this.database.raw<Record<string, unknown>>(
      `select co.id, co.reference, co.status, co.total_paid, co.currency, co.customer_snapshot, co.created_at,
       pi.status as payment_status, sfp.status as gate_status,
       (select count(*)::int from order_exception oe where oe.customer_order_id = co.id and oe.status = 'OPEN' and oe.deleted_at is null) as open_exceptions
       from customer_order co join payment_intent pi on pi.id = co.payment_intent_id
       left join supplier_fulfillment_plan sfp on sfp.customer_order_id = co.id and sfp.deleted_at is null
       where co.deleted_at is null order by co.created_at desc limit 100`,
    );
    return result.rows.map((row) => ({
      ...row,
      customer_snapshot: maskCustomer(
        parseJson(row.customer_snapshot as string | Record<string, unknown>),
      ),
    }));
  }

  async adminDetail(customerOrderId: string): Promise<Record<string, unknown>> {
    const order = await this.getOrder(customerOrderId);
    const plan = await this.getPlan(customerOrderId);
    const groups = plan ? await this.groups(plan.id) : [];
    const supplierOrders = await this.database.raw<Record<string, unknown>>(
      "select * from supplier_order where customer_order_id = ? and deleted_at is null order by created_at",
      [customerOrderId],
    );
    const tracking = await this.database.raw<Record<string, unknown>>(
      `select ft.* from fulfillment_tracking ft join supplier_order so on so.id = ft.supplier_order_id where so.customer_order_id = ? and ft.deleted_at is null order by ft.created_at`,
      [customerOrderId],
    );
    const exceptions = await this.database.raw<Record<string, unknown>>(
      "select * from order_exception where customer_order_id = ? and deleted_at is null order by created_at desc",
      [customerOrderId],
    );
    const assessment = await this.assess(customerOrderId);
    const audits = await this.database.raw<Record<string, unknown>>(
      "select action, summary, actor_id, metadata, created_at from audit_event where (entity_id = ? or metadata->>'customer_order_id' = ?) and deleted_at is null order by created_at desc",
      [customerOrderId, customerOrderId],
    );
    return {
      order: normalizeOrder(order),
      plan,
      groups: groups.map(normalizeGroup),
      gate: assessment,
      supplierOrders: supplierOrders.rows,
      tracking: tracking.rows,
      exceptions: exceptions.rows,
      audit: audits.rows,
      realExecutionEnabled: false,
    };
  }

  async alternatives(
    customerOrderId: string,
  ): Promise<Record<string, unknown>[]> {
    const order = await this.getOrder(customerOrderId);
    const variants = asItems(order.items_snapshot).map(
      (item) => item.variantId,
    );
    const result = await this.database.raw<Record<string, unknown>>(
      `select distinct so.id as offer_id, so.product_id, so.unit_cost, so.currency, so.availability, so.fulfillment_mode,
       so.private_label_supported, s.id as supplier_id, s.provider, s.country_code, s.status as supplier_status,
       svm.store_variant_id, sq.normalized_amount_brl as shipping_brl, sq.estimated_min_days, sq.estimated_max_days
       from supplier_offer so join supplier s on s.id = so.supplier_id
       join supplier_variant_map svm on svm.supplier_offer_id = so.id
       left join lateral (select * from shipping_quote q where q.supplier_offer_id = so.id and q.variant_id = svm.store_variant_id and q.deleted_at is null order by q.created_at desc limit 1) sq on true
       where svm.store_variant_id = any(?::text[]) and so.status = 'ACTIVE' and s.status = 'ACTIVE' and so.deleted_at is null`,
      [variants],
    );
    return result.rows;
  }

  async selectAlternative(
    customerOrderId: string,
    groupId: string,
    offerId: string,
    actor: string,
  ): Promise<void> {
    await this.database.transaction(async (trx) => {
      await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [
        `supplier-fallback:${customerOrderId}`,
      ]);
      const order = await this.getOrder(customerOrderId, trx);
      const plan = await this.getPlan(customerOrderId, trx);
      if (!plan)
        throw new FulfillmentError(
          "PLAN_NOT_FOUND",
          "Plano não encontrado",
          404,
        );
      const group = (await this.groups(plan.id, trx)).find(
        (candidate) => candidate.id === groupId,
      );
      if (!group)
        throw new FulfillmentError(
          "GROUP_NOT_FOUND",
          "Grupo não encontrado",
          404,
        );
      const submitted = await trx.raw<{ status: string }>(
        `select status from supplier_order where fulfillment_group_id = ? and deleted_at is null and status in ('SUBMITTING','SUBMITTED','CONFIRMED','SHIPPED','DELIVERED')`,
        [group.id],
      );
      if (submitted.rows[0])
        throw new FulfillmentError(
          "SUPPLIER_ORDER_ALREADY_SUBMITTED",
          "Fornecedor não pode ser trocado após envio; intervenção necessária",
        );
      const item = asItems(group.items_snapshot)[0];
      if (!item)
        throw new FulfillmentError(
          "GROUP_ITEM_MISSING",
          "Item do grupo não encontrado",
          500,
        );
      const quote = await trx.raw<{ id: string }>(
        `select sq.id from shipping_quote sq join supplier_offer so on so.id = sq.supplier_offer_id
         join supplier s on s.id = so.supplier_id
         where sq.supplier_offer_id = ? and sq.variant_id = ? and sq.status = 'VALID'
         and so.status = 'ACTIVE' and s.status = 'ACTIVE' and sq.deleted_at is null and so.deleted_at is null
         order by sq.created_at desc limit 1`,
        [offerId, item.variantId],
      );
      const quoteId = quote.rows[0]?.id;
      if (!quoteId)
        throw new FulfillmentError(
          "ALTERNATIVE_QUOTE_REQUIRED",
          "Alternativa precisa de cotação válida antes da seleção",
        );
      const [route] = await this.routesForOrder(
        { shipping_snapshot: JSON.stringify([{ quoteId }]) } as OrderRow,
        trx,
      );
      if (!route || route.availability === "OUT_OF_STOCK")
        throw new FulfillmentError(
          "ALTERNATIVE_UNAVAILABLE",
          "Alternativa indisponível",
        );
      const sourceTotal = Number(route.unit_cost) * item.quantity;
      const productBrl = route.fx_rate
        ? sourceTotal * Number(route.fx_rate)
        : null;
      const delivered =
        productBrl === null || route.normalized_amount_brl === null
          ? null
          : productBrl + Number(route.normalized_amount_brl);
      const routing: RoutingSnapshot = {
        offerId: route.supplier_offer_id,
        supplierId: route.supplier_id,
        provider: route.supplier_provider,
        inventoryStatus: route.availability,
        sourceCost: sourceTotal.toFixed(2),
        shippingCost: route.provider_amount,
        deliveredCost: delivered?.toFixed(2) ?? "UNKNOWN",
        currency: route.currency,
        eta: {
          minimumDays: route.estimated_min_days,
          maximumDays: route.estimated_max_days,
        },
        compatibility: {
          fulfillmentMode: route.fulfillment_mode,
          privateLabel: route.private_label_supported,
          compliance: route.compliance_status ?? "PENDING",
        },
        score: null,
        reasons: [
          "alternativa selecionada manualmente",
          ...routingReasons(route),
        ],
        capturedAt: new Date().toISOString(),
      };
      const shipping: ShippingQuoteSnapshot = {
        quoteId: route.quote_id,
        providerAmount: route.provider_amount,
        normalizedAmountBrl: route.normalized_amount_brl,
        method: route.method_name,
        expiresAt: new Date(route.quote_expires_at).toISOString(),
        status: route.quote_status,
        eta: {
          minimumDays: route.estimated_min_days,
          maximumDays: route.estimated_max_days,
        },
      };
      await trx.raw(
        `update supplier_fulfillment_group set supplier_id = ?, supplier_offer_id = ?, provider = ?, fulfillment_mode = ?,
         shipping_quote_snapshot = ?::jsonb, routing_snapshot = ?::jsonb, approval_fingerprint = null, updated_at = now() where id = ?`,
        [
          route.supplier_id,
          route.supplier_offer_id,
          route.supplier_provider,
          route.fulfillment_mode,
          JSON.stringify(shipping),
          JSON.stringify(routing),
          group.id,
        ],
      );
      await trx.raw(
        `update supplier_fulfillment_plan set status = 'APPROVAL_REQUIRED', version = version + 1,
         approved_at = null, approved_by = null, approved_margin_brl = null, approval_snapshot = null, updated_at = now() where id = ?`,
        [plan.id],
      );
      await trx.raw(
        "update supplier_order set status = 'CANCELLED', updated_at = now() where fulfillment_group_id = ? and status = 'APPROVED' and deleted_at is null",
        [group.id],
      );
      await trx.raw(
        "update customer_order set status = 'SUPPLIER_APPROVAL_REQUIRED', updated_at = now() where id = ?",
        [order.id],
      );
      await audit(
        trx,
        "SUPPLIER_FALLBACK_SELECTED",
        group.id,
        "Alternativa de fornecedor selecionada; aprovação anterior invalidada",
        {
          customer_order_id: order.id,
          prior_offer_id: group.supplier_offer_id,
          selected_offer_id: route.supplier_offer_id,
          approver: actor,
        },
      );
    });
  }

  async updateException(
    customerOrderId: string,
    exceptionId: string,
    status: "ACKNOWLEDGED" | "RESOLVED",
    actor: string,
  ): Promise<void> {
    const result = await this.database.raw<{ id: string }>(
      `update order_exception set status = ?,
       acknowledged_by = case when ? = 'ACKNOWLEDGED' then ? else acknowledged_by end,
       acknowledged_at = case when ? = 'ACKNOWLEDGED' then now() else acknowledged_at end,
       resolved_by = case when ? = 'RESOLVED' then ? else resolved_by end,
       resolved_at = case when ? = 'RESOLVED' then now() else resolved_at end,
       updated_at = now() where id = ? and customer_order_id = ? and deleted_at is null returning id`,
      [
        status,
        status,
        actor,
        status,
        status,
        actor,
        status,
        exceptionId,
        customerOrderId,
      ],
    );
    if (!result.rows[0])
      throw new FulfillmentError(
        "EXCEPTION_NOT_FOUND",
        "Exceção não encontrada",
        404,
      );
    await audit(
      this.database,
      `ORDER_EXCEPTION_${status}`,
      exceptionId,
      `Exceção ${status.toLowerCase()}`,
      { customer_order_id: customerOrderId, approver: actor },
    );
  }

  private async getOrder(
    id: string,
    database = this.database,
  ): Promise<OrderRow> {
    const result = await database.raw<OrderRow>(
      "select * from customer_order where id = ? and deleted_at is null",
      [id],
    );
    if (!result.rows[0])
      throw new FulfillmentError(
        "ORDER_NOT_FOUND",
        "Pedido não encontrado",
        404,
      );
    return normalizeOrder(result.rows[0]);
  }
  private async getPlan(
    orderId: string,
    database = this.database,
  ): Promise<PlanRow | null> {
    const result = await database.raw<PlanRow>(
      "select * from supplier_fulfillment_plan where customer_order_id = ? and deleted_at is null",
      [orderId],
    );
    return result.rows[0] ?? null;
  }
  private async groups(
    planId: string,
    database = this.database,
  ): Promise<GroupRow[]> {
    const result = await database.raw<GroupRow>(
      "select * from supplier_fulfillment_group where plan_id = ? and deleted_at is null order by created_at",
      [planId],
    );
    return result.rows.map(normalizeGroup);
  }
  private async routesForOrder(
    order: OrderRow,
    database: OrderDatabase,
  ): Promise<RouteRow[]> {
    const quoteIds = asShipping(order.shipping_snapshot).map(
      (item) => item.quoteId,
    );
    const result = await database.raw<RouteRow>(
      `select sq.id as quote_id, sq.status as quote_status, sq.expires_at as quote_expires_at, sq.variant_id, sq.quantity,
       sq.provider_amount, sq.normalized_amount_brl, sq.estimated_min_days, sq.estimated_max_days, sq.method_name,
       so.id as supplier_offer_id, so.product_id, so.status as offer_status, so.availability, so.availability_quantity,
       so.currency, so.unit_cost, so.fulfillment_mode, so.private_label_supported, so.branding_moq, so.branding_profile_id,
       s.id as supplier_id, s.provider as supplier_provider, s.status as supplier_status, s.country_code as supplier_country_code,
       svm.supplier_sku, pp.compliance_status,
       (select cq.fx_rate from cost_quote cq where cq.supplier_offer_id = so.id and cq.deleted_at is null order by cq.updated_at desc limit 1) as fx_rate
       from shipping_quote sq join supplier_offer so on so.id = sq.supplier_offer_id
       join supplier s on s.id = so.supplier_id
       left join supplier_variant_map svm on svm.supplier_offer_id = so.id and svm.store_variant_id = sq.variant_id and svm.deleted_at is null
       left join product_policy pp on pp.product_id = so.product_id and pp.deleted_at is null
       where sq.id = any(?::text[]) and sq.deleted_at is null order by sq.created_at`,
      [quoteIds],
    );
    return result.rows;
  }
  private async currentRoute(
    group: GroupRow,
    database: OrderDatabase,
  ): Promise<RouteRow | null> {
    const shipping = parseJson<ShippingQuoteSnapshot>(
      group.shipping_quote_snapshot,
    );
    const fakeOrder = {
      shipping_snapshot: JSON.stringify([{ quoteId: shipping.quoteId }]),
    } as OrderRow;
    return (await this.routesForOrder(fakeOrder, database))[0] ?? null;
  }
  private async fingerprint(
    groups: GroupRow[],
    database: OrderDatabase,
  ): Promise<string> {
    const current = await Promise.all(
      groups.map((group) => this.currentRoute(group, database)),
    );
    return createHash("sha256")
      .update(
        JSON.stringify(
          current.map((route) =>
            route
              ? [
                  route.supplier_offer_id,
                  route.unit_cost,
                  route.provider_amount,
                  route.availability,
                  route.offer_status,
                  route.supplier_status,
                ]
              : null,
          ),
        ),
      )
      .digest("hex");
  }
  private async persistExceptions(
    orderId: string,
    assessment: Awaited<ReturnType<FulfillmentService["assess"]>>,
    database: OrderDatabase,
  ): Promise<void> {
    for (const reason of assessment.reasons) {
      const type = exceptionType(reason);
      await database.raw(
        `insert into order_exception (id, customer_order_id, type, severity, status, message, details)
         values (?, ?, ?, ?, 'OPEN', ?, ?::jsonb)`,
        [
          `ordexc_${randomUUID().replaceAll("-", "")}`,
          orderId,
          type,
          assessment.status === "BLOCKED" ? "BLOCKING" : "ACTION_REQUIRED",
          exceptionMessage(type),
          JSON.stringify({ reason }),
        ],
      );
    }
  }
}

function normalizeOrder(order: OrderRow): OrderRow {
  return {
    ...order,
    address_snapshot: parseJson(order.address_snapshot),
    items_snapshot: parseJson(order.items_snapshot),
    shipping_snapshot: parseJson(order.shipping_snapshot),
  };
}
function normalizeGroup(group: GroupRow): GroupRow {
  return {
    ...group,
    items_snapshot: parseJson(group.items_snapshot),
    shipping_quote_snapshot: parseJson(group.shipping_quote_snapshot),
    routing_snapshot: parseJson(group.routing_snapshot),
  };
}
function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}
function asItems(value: Item[] | string): Item[] {
  return parseJson(value);
}
function asShipping(value: OrderRow["shipping_snapshot"]): Selection[] {
  return parseJson(value);
}
function routingReasons(route: RouteRow): string[] {
  const reasons = [
    "oferta selecionada no checkout",
    "custo e frete congelados na venda",
  ];
  if (route.fulfillment_mode === "BRAZIL_STOCK")
    reasons.push("estoque nacional");
  if (route.private_label_supported) reasons.push("private label suportado");
  return reasons;
}
function validAddress(address: Address): boolean {
  return Boolean(
    address.street &&
    address.number &&
    address.city &&
    address.state &&
    /^\d{8}$/.test(address.postalCode),
  );
}
function addressHash(address: Address): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        address.street,
        address.number,
        address.city,
        address.state,
        address.postalCode,
      ]),
    )
    .digest("hex");
}
function configuredNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
function configuredPercent(
  name: string,
  fallback: number,
  base: number,
): number {
  return (base * configuredNumber(name, fallback)) / 100;
}
function approvalFingerprint(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("fingerprint" in value))
    return null;
  return typeof value.fingerprint === "string" ? value.fingerprint : null;
}
export function sanitizeRecipientForSandbox(address: Address) {
  return {
    name: "CLIENTE TESTE",
    address1: `${address.street.slice(0, 3)}***, ***`,
    address2: null,
    city: address.city,
    state: address.state,
    postalCode: `*****${address.postalCode.slice(-3)}`,
    countryCode: "BR" as const,
    phone: "TEST-NOT-SENT",
  };
}
function maskCustomer(value: Record<string, unknown>): Record<string, unknown> {
  const email = typeof value.email === "string" ? value.email : "";
  const [local = "", domain = ""] = email.split("@");
  return {
    name:
      typeof value.name === "string" ? `${value.name.slice(0, 1)}***` : "***",
    email: `${local.slice(0, 1)}***@${domain}`,
    phone: "***",
  };
}
function exceptionType(reason: string): string {
  if (
    [
      "OUT_OF_STOCK",
      "PRICE_CHANGED",
      "SHIPPING_CHANGED",
      "PROVIDER_UNAVAILABLE",
      "ADDRESS_PROBLEM",
      "COMPLIANCE_HOLD",
      "MARGIN_TOO_LOW",
    ].includes(reason)
  )
    return reason;
  return "UNKNOWN";
}
function exceptionMessage(type: string): string {
  if (type === "PRICE_CHANGED")
    return "Custo do fornecedor mudou desde a venda.";
  if (type === "SHIPPING_CHANGED")
    return "Frete do fornecedor mudou desde a venda.";
  if (type === "OUT_OF_STOCK") return "Oferta selecionada está sem estoque.";
  return "Pedido requer intervenção operacional.";
}
async function audit(
  database: OrderDatabase,
  action: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await database.raw(
    `insert into audit_event (id, action, entity_type, entity_id, actor_id, summary, before, after, metadata) values (?, ?, 'fulfillment', ?, ?, ?, null, null, ?::jsonb)`,
    [
      `audit_${randomUUID().replaceAll("-", "")}`,
      action,
      entityId,
      typeof metadata.approver === "string" ? metadata.approver : null,
      summary,
      JSON.stringify(metadata),
    ],
  );
}
function required<T>(value: T | undefined): T {
  if (!value)
    throw new FulfillmentError(
      "FULFILLMENT_WRITE_FAILED",
      "Falha ao persistir fulfillment",
      500,
    );
  return value;
}
