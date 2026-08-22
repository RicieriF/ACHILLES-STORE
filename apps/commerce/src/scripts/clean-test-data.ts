import { randomUUID } from "node:crypto";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

type QueryResult<T> = { rows: T[] };
type CleanupDatabase = {
  raw<T>(sql: string, bindings?: readonly unknown[]): Promise<QueryResult<T>>;
  transaction<T>(
    operation: (transaction: CleanupDatabase) => Promise<T>,
  ): Promise<T>;
};

type CleanupCount = { entity: string; count: number };

const allowedEnvironments = new Set(["development", "test", "staging"]);

export function assertCleanupEnvironment(environment: string): void {
  if (environment === "production")
    throw new Error("TEST_DATA_CLEANUP_FORBIDDEN_IN_PRODUCTION");
  if (!allowedEnvironments.has(environment))
    throw new Error("TEST_DATA_CLEANUP_ENVIRONMENT_NOT_ALLOWED");
  if (
    environment === "staging" &&
    process.env.ALLOW_STAGING_TEST_DATA_CLEANUP !== "true"
  )
    throw new Error(
      "STAGING_TEST_DATA_CLEANUP_REQUIRES_EXPLICIT_AUTHORIZATION",
    );
}

export default async function cleanTestData({ container }: ExecArgs) {
  const environment = process.env.APP_ENV ?? "development";
  assertCleanupEnvironment(environment);

  const dryRun = process.env.CLEAN_TEST_DATA_DRY_RUN === "true";
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const database = container.resolve<CleanupDatabase>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );

  const counts = await database.transaction(async (trx) => {
    await createTargets(trx);
    const current = await countTargets(trx);
    if (!dryRun) {
      await softDeleteTargets(trx);
      await trx.raw(
        `insert into audit_event
          (id, action, entity_type, entity_id, actor_id, summary, before, after, metadata)
         values (?, 'TEST_DATA_CLEANUP', 'system', 'test-data', null, ?, null, null, ?::jsonb)`,
        [
          `cleanup_${randomUUID().replaceAll("-", "")}`,
          "Limpeza segura de dados marcados como TEST/SANDBOX/DEMO",
          JSON.stringify({ environment, counts: current }),
        ],
      );
    }
    return current;
  });

  logger.info(`Test data cleanup ${dryRun ? "dry run" : "executed"}.`);
  logger.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      environment,
      dryRun,
      counts,
    }),
  );
}

async function createTargets(database: CleanupDatabase): Promise<void> {
  await database.raw(`create temporary table cleanup_payments on commit drop as
    select id, checkout_session_id, taxpayer_identity_id from payment_intent
    where deleted_at is null and provider = 'TEST'`);
  await database.raw(
    `create temporary table cleanup_checkouts on commit drop as
    select distinct id, cart_id from checkout_session
    where deleted_at is null and (
      id in (select checkout_session_id from cleanup_payments)
        or cart_id in (
          select id from cart where deleted_at is null
            and metadata->>'achilles_test_fixture' = 'true'
        )
      )`,
  );
  await database.raw(`create temporary table cleanup_customer_orders on commit drop as
    select id, medusa_order_id from customer_order
    where deleted_at is null and (
      payment_intent_id in (select id from cleanup_payments)
      or checkout_session_id in (select id from cleanup_checkouts)
    )`);
  await database.raw(
    `create temporary table cleanup_products on commit drop as
      select distinct product.id from product
      left join product_variant on product_variant.product_id = product.id
        and product_variant.deleted_at is null
      where product.deleted_at is null and (
        product.metadata->>'seed' = any (?::text[])
        or product.metadata->>'achilles_test_fixture' = 'true'
        or product.metadata->>'supplier_product_id' like 'CJ-FIXTURE-%'
        or product.handle like 'e2e-%'
        or product.handle like 'ficticio-%'
        or (
          product.title like '[E2E]%'
          and (
            product.metadata->>'achilles_test_fixture' = 'true'
            or product.metadata->>'supplier_product_id' like 'CJ-FIXTURE-%'
            or coalesce(product.metadata->>'seed','') like '%DEVELOPMENT_ONLY%'
          )
        )
        or (
          product.status = 'draft' and (
            product_variant.sku ~ '^ACH-CAND-(00[1-9]|01[0-5])$'
            or upper(product.title) = 'TESTE'
          )
        )
      ) and not exists (
        select 1 from order_line_item
        join order_item on order_item.id = order_line_item.totals_id
        where order_line_item.product_id = product.id
          and order_line_item.deleted_at is null
          and order_item.deleted_at is null
          and order_item.order_id not in (
            select medusa_order_id from cleanup_customer_orders
          )
      )`,
    [
      [
        "TASK_002_DEVELOPMENT_ONLY",
        "TASK_013_DEVELOPMENT_ONLY",
        "E2E_FIXTURE_ONLY",
      ],
    ],
  );
  await database.raw(`insert into cleanup_checkouts (id, cart_id)
    select distinct checkout_session.id, checkout_session.cart_id
    from checkout_session
    join cart_line_item on cart_line_item.cart_id = checkout_session.cart_id
      and cart_line_item.deleted_at is null
    where checkout_session.deleted_at is null
      and cart_line_item.product_id in (select id from cleanup_products)
    on conflict do nothing`);
  await database.raw(`create temporary table cleanup_supplier_orders on commit drop as
    select id from supplier_order
    where deleted_at is null and (sandbox = true or provider = 'TEST'
      or customer_order_id in (select id from cleanup_customer_orders))`);
  await database.raw(`create temporary table cleanup_offers on commit drop as
    select id from supplier_offer where deleted_at is null and (
      product_id in (select id from cleanup_products)
      or source_url like 'https://example.invalid/%'
    )`);
  await database.raw(`create temporary table cleanup_suppliers on commit drop as
    select supplier.id from supplier
    where supplier.deleted_at is null
      and supplier.metadata->>'seed' = 'TASK_003_DEVELOPMENT_ONLY'
      and not exists (
        select 1 from supplier_offer retained_offer
        where retained_offer.supplier_id = supplier.id
          and retained_offer.deleted_at is null
          and retained_offer.id not in (select id from cleanup_offers)
      )`);
  await database.raw(`create temporary table cleanup_plans on commit drop as
    select id from supplier_fulfillment_plan where deleted_at is null
      and customer_order_id in (select id from cleanup_customer_orders)`);
  await database.raw(`create temporary table cleanup_groups on commit drop as
    select id from supplier_fulfillment_group where deleted_at is null
      and plan_id in (select id from cleanup_plans)`);
  await database.raw(`create temporary table cleanup_taxpayers on commit drop as
    select distinct taxpayer_identity_id as id from cleanup_payments
    where taxpayer_identity_id is not null and not exists (
      select 1 from payment_intent other
      where other.taxpayer_identity_id = cleanup_payments.taxpayer_identity_id
        and other.deleted_at is null and other.provider <> 'TEST'
    )`);
  await database.raw(`create temporary table cleanup_import_drafts on commit drop as
    select id from import_draft
    where deleted_at is null and (
      raw_provider_metadata->>'achilles_test_fixture' = 'true'
      or source_url like 'https://example.invalid/%'
      or source_url like 'https://fixture.invalid/%'
      or canonical_source_url like '%Fictitious-Rechargeable-Outdoor-Flashlight%'
      or (
        title_normalized like '[E2E]%'
        and (
          raw_provider_metadata->>'achilles_test_fixture' = 'true'
          or source_url like 'https://example.invalid/%'
          or source_url like 'https://fixture.invalid/%'
        )
      )
    )`);
  await database.raw(`create temporary table cleanup_customers on commit drop as
    select customer.id from customer
    where customer.deleted_at is null and customer.has_account = false
      and exists (
        select 1 from "order" fixture_order
        where fixture_order.customer_id = customer.id
          and fixture_order.deleted_at is null
          and fixture_order.id in (
            select medusa_order_id from cleanup_customer_orders
          )
      )
      and not exists (
        select 1 from "order" retained_order
        where retained_order.customer_id = customer.id
          and retained_order.deleted_at is null
          and retained_order.id not in (
            select medusa_order_id from cleanup_customer_orders
          )
      )`);
}

const countQueries: ReadonlyArray<readonly [string, string]> = [
  [
    "CustomerOrders TEST",
    "select count(*)::int count from cleanup_customer_orders",
  ],
  [
    "Medusa Orders E2E",
    "select count(*)::int count from cleanup_customer_orders",
  ],
  ["PaymentIntents TEST", "select count(*)::int count from cleanup_payments"],
  [
    "PaymentProviderEvents TEST",
    "select count(*)::int count from payment_provider_event where deleted_at is null and provider = 'TEST'",
  ],
  [
    "CheckoutSessions TEST",
    "select count(*)::int count from cleanup_checkouts",
  ],
  [
    "Carts E2E",
    "select count(*)::int count from cart where deleted_at is null and id in (select cart_id from cleanup_checkouts)",
  ],
  [
    "SupplierFulfillmentPlans TEST",
    "select count(*)::int count from cleanup_plans",
  ],
  ["FulfillmentGroups TEST", "select count(*)::int count from cleanup_groups"],
  [
    "SupplierOrders sandbox",
    "select count(*)::int count from cleanup_supplier_orders",
  ],
  [
    "FulfillmentTracking fictício",
    "select count(*)::int count from fulfillment_tracking where deleted_at is null and (sandbox = true or supplier_order_id in (select id from cleanup_supplier_orders))",
  ],
  [
    "OrderExceptions teste",
    "select count(*)::int count from order_exception where deleted_at is null and customer_order_id in (select id from cleanup_customer_orders)",
  ],
  [
    "SupplierOffers fictícias",
    "select count(*)::int count from cleanup_offers",
  ],
  ["Fornecedores seed", "select count(*)::int count from cleanup_suppliers"],
  [
    "Customers exclusivamente TEST",
    "select count(*)::int count from cleanup_customers",
  ],
  ["Produtos demo", "select count(*)::int count from cleanup_products"],
  [
    "ImportDrafts TEST",
    "select count(*)::int count from cleanup_import_drafts",
  ],
];

async function countTargets(
  database: CleanupDatabase,
): Promise<CleanupCount[]> {
  const counts: CleanupCount[] = [];
  for (const [entity, sql] of countQueries) {
    const result = await database.raw<{ count: number }>(sql);
    counts.push({ entity, count: result.rows[0]?.count ?? 0 });
  }
  return counts;
}

async function softDeleteTargets(database: CleanupDatabase): Promise<void> {
  const statements: ReadonlyArray<{
    sql: string;
    bindings?: readonly unknown[];
  }> = [
    {
      sql: "update fulfillment_tracking set deleted_at = now(), updated_at = now() where deleted_at is null and (sandbox = true or supplier_order_id in (select id from cleanup_supplier_orders))",
    },
    {
      sql: "update order_exception set deleted_at = now(), updated_at = now() where deleted_at is null and customer_order_id in (select id from cleanup_customer_orders)",
    },
    {
      sql: "update supplier_order set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_supplier_orders)",
    },
    {
      sql: "update supplier_fulfillment_group set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_groups)",
    },
    {
      sql: "update supplier_fulfillment_plan set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_plans)",
    },
    {
      sql: "update audit_event set deleted_at = now(), updated_at = now() where deleted_at is null and (actor_id = 'development-seed' or metadata->>'sandbox' = 'true' or metadata->>'sandbox_only' = 'true' or entity_id in (select id from cleanup_customer_orders union select id from cleanup_payments union select id from cleanup_supplier_orders))",
    },
    {
      sql: "update payment_provider_event set deleted_at = now(), updated_at = now() where deleted_at is null and provider = 'TEST'",
    },
    {
      sql: "update payment_intent set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_payments)",
    },
    {
      sql: "update checkout_shipping_selection set deleted_at = now(), updated_at = now() where deleted_at is null and checkout_session_id in (select id from cleanup_checkouts)",
    },
    {
      sql: "update shipping_quote set deleted_at = now(), updated_at = now() where deleted_at is null and (cart_id in (select cart_id from cleanup_checkouts) or product_id in (select id from cleanup_products) or supplier_offer_id in (select id from cleanup_offers))",
    },
    {
      sql: "update supplier_routing_decision set deleted_at = now(), updated_at = now() where deleted_at is null and (cart_id in (select cart_id from cleanup_checkouts) or product_id in (select id from cleanup_products))",
    },
    {
      sql: "update customer_order set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_customer_orders)",
    },
    {
      sql: "update checkout_session set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_checkouts)",
    },
    {
      sql: "update taxpayer_identity set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_taxpayers)",
    },
    {
      sql: 'update "order" set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select medusa_order_id from cleanup_customer_orders)',
    },
    {
      sql: "update customer_address set deleted_at = now(), updated_at = now() where deleted_at is null and customer_id in (select id from cleanup_customers)",
    },
    {
      sql: "update customer set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_customers)",
    },
    {
      sql: "update cart set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select cart_id from cleanup_checkouts)",
    },
    {
      sql: "update pricing_snapshot set deleted_at = now(), updated_at = now() where deleted_at is null and cost_quote_id in (select id from cost_quote where supplier_offer_id in (select id from cleanup_offers))",
    },
    {
      sql: "update cost_quote set deleted_at = now(), updated_at = now() where deleted_at is null and supplier_offer_id in (select id from cleanup_offers)",
    },
    {
      sql: "update supplier_variant_map set deleted_at = now(), updated_at = now() where deleted_at is null and supplier_offer_id in (select id from cleanup_offers)",
    },
    {
      sql: "update supplier_offer set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_offers)",
    },
    {
      sql: "update branding_profile set deleted_at = now(), updated_at = now() where deleted_at is null and supplier_id in (select id from cleanup_suppliers)",
    },
    {
      sql: "update product_policy set deleted_at = now(), updated_at = now() where deleted_at is null and product_id in (select id from cleanup_products)",
    },
    {
      sql: "update product_variant set deleted_at = now(), updated_at = now() where deleted_at is null and product_id in (select id from cleanup_products)",
    },
    {
      sql: "update import_attempt set deleted_at = now(), updated_at = now() where deleted_at is null and import_draft_id in (select id from cleanup_import_drafts)",
    },
    {
      sql: "update import_draft set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_import_drafts)",
    },
    {
      sql: "update supplier set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_suppliers)",
    },
    {
      sql: "update product set deleted_at = now(), updated_at = now() where deleted_at is null and id in (select id from cleanup_products)",
    },
  ];
  for (const statement of statements)
    await database.raw(statement.sql, statement.bindings);
}
