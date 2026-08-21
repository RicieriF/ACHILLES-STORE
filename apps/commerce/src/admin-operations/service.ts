import { integrationCards } from "../integrations/status";
import {
  attentionPriority,
  enrichOperationalProduct,
  type AttentionReason,
  type OperationalProduct,
  type OperationalProductCandidate,
} from "./types";

export type OperationsDatabase = {
  // Knex raw is intentionally generic at this isolated database boundary.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  raw<T>(sql: string, bindings?: readonly unknown[]): Promise<{ rows: T[] }>;
};

type CatalogRow = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: Date | string;
  sku: string | null;
  manage_inventory: boolean | null;
  stock: string | number | null;
  retail_price: string | number | null;
  compare_at_price: string | number | null;
  category: string | null;
  category_id: string | null;
  offer_count: string | number;
  offer_id: string | null;
  supplier_id: string | null;
  supplier_status: string | null;
  offer_status: string | null;
  supplier: string | null;
  provider: string | null;
  origin: string | null;
  availability: string | null;
  availability_quantity: string | number | null;
  branding_lead_time_days: string | number | null;
  fulfillment_mode: string | null;
  sync_status: string | null;
  last_sync_at: Date | string | null;
  compliance_status: string | null;
  commercial_readiness: string | null;
  pricing_status: string | null;
  landed_cost: string | number | null;
  margin_percent: string | number | null;
  shipping_stale: boolean | null;
};

type CountRow = { count: number };
type TodayRow = {
  sales: string | null;
  orders: number;
  average_ticket: string | null;
  estimated_profit: string | null;
};
type OperationalCountRow = {
  pending_payments: number;
  awaiting_supplier: number;
  exceptions: number;
};
type ProviderCountRow = {
  provider: string;
  suppliers: number;
  offers: number;
  products: number;
  problems: number;
};
type CatalogSummaryRow = {
  total: number;
  published: number;
  drafts: number;
  without_price: number;
  without_stock: number;
  without_supplier: number;
  compliance_pending: number;
  blocked: number;
};

export type CatalogQuery = {
  q?: string;
  limit: number;
  offset: number;
};

export type ProviderSummary = {
  provider: "ALIBABA" | "CJ" | "BRAZIL_STOCK";
  status: string;
  health: string;
  suppliers: number;
  offers: number;
  products: number;
  problems: number;
};

const catalogCtes = `
with variant_base as (
  select pv.product_id,
    min(pv.sku) filter (where pv.sku is not null) as sku,
    bool_or(pv.manage_inventory) as manage_inventory
  from product_variant pv
  where pv.deleted_at is null
  group by pv.product_id
), product_prices as (
  select pv.product_id,
    min(pr.amount) filter (where pr.currency_code = 'brl' and pr.price_list_id is null) as retail_price,
    min(pr.amount) filter (where pr.currency_code = 'brl' and pr.price_list_id is not null) as compare_at_price
  from product_variant pv
  join product_variant_price_set pvps on pvps.variant_id = pv.id and pvps.deleted_at is null
  join price pr on pr.price_set_id = pvps.price_set_id and pr.deleted_at is null
  where pv.deleted_at is null
  group by pv.product_id
), product_stock as (
  select pv.product_id,
    sum(coalesce(il.stocked_quantity, 0) - coalesce(il.reserved_quantity, 0)) as stock
  from product_variant pv
  join product_variant_inventory_item pvii on pvii.variant_id = pv.id and pvii.deleted_at is null
  left join inventory_level il on il.inventory_item_id = pvii.inventory_item_id and il.deleted_at is null
  where pv.deleted_at is null
  group by pv.product_id
), product_categories as (
  select pcp.product_id,
    min(pc.id) as category_id,
    string_agg(distinct pc.name, ', ' order by pc.name) as category
  from product_category_product pcp
  join product_category pc on pc.id = pcp.product_category_id and pc.deleted_at is null
  group by pcp.product_id
), offer_counts as (
  select so.product_id,
    count(*)::int as offer_count
  from supplier_offer so
  where so.deleted_at is null
  group by so.product_id
), primary_offers as (
  select distinct on (so.product_id)
    so.product_id, so.id as offer_id, so.supplier_id, s.name as supplier,
    s.provider, s.status as supplier_status, so.source_url as origin,
    so.availability, so.availability_quantity, so.branding_lead_time_days,
    so.fulfillment_mode, so.sync_status, so.last_sync_at,
    so.status as offer_status
  from supplier_offer so
  join supplier s on s.id = so.supplier_id and s.deleted_at is null
  where so.deleted_at is null
  order by so.product_id, so.is_primary desc, so.updated_at desc
), quote_data as (
  select distinct on (cq.supplier_offer_id)
    cq.supplier_offer_id, cq.status as pricing_status,
    cq.landed_cost, cq.gross_margin_percent as margin_percent
  from cost_quote cq
  where cq.deleted_at is null
  order by cq.supplier_offer_id, cq.updated_at desc
), shipping_data as (
  select sq.supplier_offer_id,
    bool_or(sq.status in ('EXPIRED', 'FAILED', 'UNAVAILABLE') or sq.expires_at <= now()) as shipping_stale
  from shipping_quote sq
  where sq.deleted_at is null
  group by sq.supplier_offer_id
)
`;

const catalogSelect = `
select p.id, p.title, p.handle, p.status, p.thumbnail, p.metadata, p.updated_at,
  vb.sku, coalesce(vb.manage_inventory, false) as manage_inventory,
  ps.stock, pp.retail_price, pp.compare_at_price,
  pc.category, pc.category_id,
  coalesce(oc.offer_count, 0)::int as offer_count,
  po.offer_id, po.supplier_id, po.supplier, po.provider, po.origin,
  po.supplier_status, po.offer_status,
  po.availability, po.availability_quantity, po.branding_lead_time_days,
  po.fulfillment_mode, po.sync_status, po.last_sync_at,
  pol.compliance_status, pol.commercial_readiness,
  qd.pricing_status, qd.landed_cost, qd.margin_percent,
  coalesce(sd.shipping_stale, false) as shipping_stale
from product p
left join variant_base vb on vb.product_id = p.id
left join product_prices pp on pp.product_id = p.id
left join product_stock ps on ps.product_id = p.id
left join product_categories pc on pc.product_id = p.id
left join offer_counts oc on oc.product_id = p.id
left join primary_offers po on po.product_id = p.id
left join product_policy pol on pol.product_id = p.id and pol.deleted_at is null
left join quote_data qd on qd.supplier_offer_id = po.offer_id
left join shipping_data sd on sd.supplier_offer_id = po.offer_id
where p.deleted_at is null
`;

export async function listOperationalProducts(
  database: OperationsDatabase,
  query: CatalogQuery,
): Promise<{ products: OperationalProduct[]; count: number }> {
  const term = query.q?.trim() ?? "";
  const searchSql = term
    ? " and (p.title ilike ? or vb.sku ilike ? or pc.category ilike ?)"
    : "";
  const searchBindings: string[] = term
    ? Array<string>(3).fill(`%${term}%`)
    : [];
  const [{ rows }, countResult] = await Promise.all([
    database.raw<CatalogRow>(
      `${catalogCtes}${catalogSelect}${searchSql}
       order by p.updated_at desc limit ? offset ?`,
      [...searchBindings, query.limit, query.offset],
    ),
    database.raw<CountRow>(
      `${catalogCtes}select count(*)::int as count from (${catalogSelect}${searchSql}) catalog_count`,
      searchBindings,
    ),
  ]);
  return {
    products: rows.map(mapProduct),
    count: countResult.rows[0]?.count ?? 0,
  };
}

export async function getOperationalProduct(
  database: OperationsDatabase,
  id: string,
): Promise<OperationalProduct | null> {
  const result = await database.raw<CatalogRow>(
    `${catalogCtes}${catalogSelect} and p.id = ? limit 1`,
    [id],
  );
  return result.rows[0] ? mapProduct(result.rows[0]) : null;
}

export async function getDashboard(database: OperationsDatabase) {
  const [today, operational, allProducts, catalogCounts, providers] =
    await Promise.all([
      database.raw<TodayRow>(`
      select
        coalesce(sum(co.total_paid::numeric), 0)::text as sales,
        count(*)::int as orders,
        coalesce(avg(co.total_paid::numeric), 0)::text as average_ticket,
        sum(sfp.approved_margin_brl::numeric)::text as estimated_profit
      from customer_order co
      left join supplier_fulfillment_plan sfp
        on sfp.customer_order_id = co.id and sfp.deleted_at is null
      where co.deleted_at is null and co.created_at >= current_date`),
      database.raw<OperationalCountRow>(`
      select
        (select count(*)::int from payment_intent where deleted_at is null and status in ('CREATED','PENDING','PROCESSING')) as pending_payments,
        (select count(*)::int from customer_order where deleted_at is null and status in ('PAID','FULFILLMENT_REVIEW','SUPPLIER_APPROVAL_REQUIRED')) as awaiting_supplier,
        (select count(*)::int from order_exception where deleted_at is null and status <> 'RESOLVED') as exceptions`),
      listOperationalProducts(database, { limit: 100, offset: 0 }),
      database.raw<CatalogSummaryRow>(`${catalogCtes}
      select count(*)::int as total,
        count(*) filter (where status = 'published')::int as published,
        count(*) filter (where status = 'draft')::int as drafts,
        count(*) filter (where retail_price is null)::int as without_price,
        count(*) filter (where manage_inventory and coalesce(stock, 0) <= 0 or availability = 'OUT_OF_STOCK')::int as without_stock,
        count(*) filter (where offer_id is null)::int as without_supplier,
        count(*) filter (where compliance_status in ('PENDING','REVIEW_REQUIRED'))::int as compliance_pending,
        count(*) filter (where compliance_status = 'BLOCKED')::int as blocked
      from (${catalogSelect}) operational_catalog`),
      database.raw<ProviderCountRow>(`
      select s.provider,
        count(distinct s.id)::int as suppliers,
        count(distinct so.id)::int as offers,
        count(distinct so.product_id)::int as products,
        count(distinct so.id) filter (where so.status <> 'ACTIVE' or so.sync_status in ('STALE','FAILED'))::int as problems
      from supplier s
      left join supplier_offer so on so.supplier_id = s.id and so.deleted_at is null
      where s.deleted_at is null and s.provider in ('ALIBABA','CJ','BRAZIL_STOCK')
      group by s.provider`),
    ]);
  const products = allProducts.products;
  const todayRow = today.rows[0];
  const operationalRow = operational.rows[0];
  const alerts = products
    .flatMap((product) =>
      product.attention.map((reason) => ({
        productId: product.id,
        product: product.title,
        reason,
        severity: alertSeverity(reason),
      })),
    )
    .sort(
      (left, right) =>
        attentionPriority[left.reason] - attentionPriority[right.reason],
    )
    .slice(0, 30);
  return {
    today: {
      sales: numberOrZero(todayRow?.sales),
      orders: todayRow?.orders ?? 0,
      averageTicket: numberOrZero(todayRow?.average_ticket),
      estimatedProfit: numberOrNull(todayRow?.estimated_profit),
      pendingPayments: operationalRow?.pending_payments ?? 0,
      awaitingSupplier: operationalRow?.awaiting_supplier ?? 0,
      exceptions: operationalRow?.exceptions ?? 0,
    },
    catalog: mapCatalogSummary(catalogCounts.rows[0]),
    providers: providerSummaries(providers.rows),
    alerts,
    empty: allProducts.count === 0,
  };
}

function mapProduct(row: CatalogRow): OperationalProduct {
  const candidate: OperationalProductCandidate = {
    id: row.id,
    title: row.title,
    handle: row.handle,
    status: row.status,
    thumbnail: row.thumbnail,
    sku: row.sku,
    category: row.category,
    categoryId: row.category_id,
    retailPrice: numberOrNull(row.retail_price),
    compareAtPrice: numberOrNull(row.compare_at_price),
    landedCost: numberOrNull(row.landed_cost),
    marginPercent: numberOrNull(row.margin_percent),
    stock: numberOrNull(row.stock),
    manageInventory: Boolean(row.manage_inventory),
    supplier: row.supplier,
    supplierId: row.supplier_id,
    supplierStatus: row.supplier_status,
    offerStatus: row.offer_status,
    provider: row.provider,
    origin: row.origin,
    offerId: row.offer_id,
    offerCount: Number(row.offer_count),
    availability: row.availability,
    supplierAvailabilityQuantity: numberOrNull(row.availability_quantity),
    supplierLeadTimeDays: numberOrNull(row.branding_lead_time_days),
    fulfillmentMode: row.fulfillment_mode,
    compliance: row.compliance_status ?? "PENDING",
    commercialReadiness: row.commercial_readiness ?? "DATA_INCOMPLETE",
    pricingStatus: row.pricing_status,
    shippingStale: Boolean(row.shipping_stale),
    syncStatus: row.sync_status,
    lastSyncAt: row.last_sync_at
      ? new Date(row.last_sync_at).toISOString()
      : null,
    updatedAt: new Date(row.updated_at).toISOString(),
    featured: row.metadata?.featured === true,
  };
  return enrichOperationalProduct(candidate);
}

function mapCatalogSummary(row: CatalogSummaryRow | undefined) {
  return {
    total: row?.total ?? 0,
    published: row?.published ?? 0,
    drafts: row?.drafts ?? 0,
    withoutPrice: row?.without_price ?? 0,
    withoutStock: row?.without_stock ?? 0,
    withoutSupplier: row?.without_supplier ?? 0,
    compliancePending: row?.compliance_pending ?? 0,
    blocked: row?.blocked ?? 0,
  };
}

function providerSummaries(rows: ProviderCountRow[]): ProviderSummary[] {
  const cards = integrationCards();
  const definitions = [
    ["ALIBABA", "alibaba"],
    ["CJ", "cj"],
    ["BRAZIL_STOCK", "brazil-stock"],
  ] as const;
  return definitions.map(([provider, cardId]) => {
    const row = rows.find((item) => item.provider === provider);
    const card = cards.find((item) => item.id === cardId);
    return {
      provider,
      status: card?.status ?? "NOT_CONFIGURED",
      health: card?.health ?? "NOT_CONFIGURED",
      suppliers: row?.suppliers ?? 0,
      offers: row?.offers ?? 0,
      products: row?.products ?? 0,
      problems: row?.problems ?? 0,
    };
  });
}

function alertSeverity(
  reason: AttentionReason,
): "BLOCKING" | "ACTION_REQUIRED" {
  return ["BLOCKED", "SUPPLIER_UNAVAILABLE", "COMPLIANCE_REVIEW"].includes(
    reason,
  )
    ? "BLOCKING"
    : "ACTION_REQUIRED";
}

function numberOrNull(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value: string | number | null | undefined): number {
  return numberOrNull(value) ?? 0;
}
