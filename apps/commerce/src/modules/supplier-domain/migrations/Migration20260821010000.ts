import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260821010000 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(
      `create sequence if not exists "achilles_order_reference_seq";`,
    );
    this.addSql(`create table if not exists "customer_order" (
      "id" text primary key, "medusa_order_id" text not null, "payment_intent_id" text not null,
      "checkout_session_id" text not null, "reference" text not null, "access_token_hash" text not null,
      "status" text check ("status" in ('PAYMENT_PENDING','PAID','FULFILLMENT_REVIEW','SUPPLIER_APPROVAL_REQUIRED','SUPPLIER_APPROVED','ORDERING_SUPPLIER','SUPPLIER_CONFIRMED','IN_FULFILLMENT','SHIPPED','DELIVERED','EXCEPTION','CANCELLED')) not null default 'PAID',
      "currency" text not null default 'BRL', "total_paid" text not null,
      "customer_snapshot" jsonb not null, "address_snapshot" jsonb not null,
      "items_snapshot" jsonb not null, "shipping_snapshot" jsonb not null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "customer_order_payment_fk" foreign key ("payment_intent_id") references "payment_intent" ("id") on delete restrict,
      constraint "customer_order_checkout_fk" foreign key ("checkout_session_id") references "checkout_session" ("id") on delete restrict);`);
    this.addSql(
      `create unique index if not exists "IDX_customer_order_medusa_unique" on "customer_order" ("medusa_order_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create unique index if not exists "IDX_customer_order_payment_unique" on "customer_order" ("payment_intent_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create unique index if not exists "IDX_customer_order_reference_unique" on "customer_order" ("reference") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_customer_order_status" on "customer_order" ("status") where "deleted_at" is null;`,
    );

    this.addSql(`create table if not exists "supplier_fulfillment_plan" (
      "id" text primary key, "customer_order_id" text not null,
      "status" text check ("status" in ('NOT_READY','REVIEW_REQUIRED','APPROVAL_REQUIRED','APPROVED','BLOCKED','STALE','EXCEPTION')) not null default 'NOT_READY',
      "version" integer not null default 1, "revenue_brl" text not null, "approved_margin_brl" text null,
      "approved_at" timestamptz null, "approved_by" text null, "approval_snapshot" jsonb null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "supplier_plan_customer_order_fk" foreign key ("customer_order_id") references "customer_order" ("id") on delete restrict);`);
    this.addSql(
      `create unique index if not exists "IDX_supplier_plan_order_unique" on "supplier_fulfillment_plan" ("customer_order_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_supplier_plan_status" on "supplier_fulfillment_plan" ("status") where "deleted_at" is null;`,
    );

    this.addSql(`create table if not exists "supplier_fulfillment_group" (
      "id" text primary key, "plan_id" text not null, "supplier_id" text not null, "supplier_offer_id" text not null,
      "provider" text not null, "fulfillment_mode" text check ("fulfillment_mode" in ('PRIVATE_LABEL_DROPSHIP','GENERIC_DROPSHIP','BRAZIL_STOCK')) not null,
      "items_snapshot" jsonb not null, "shipping_quote_snapshot" jsonb not null, "routing_snapshot" jsonb not null,
      "approval_fingerprint" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "fulfillment_group_plan_fk" foreign key ("plan_id") references "supplier_fulfillment_plan" ("id") on delete restrict,
      constraint "fulfillment_group_supplier_fk" foreign key ("supplier_id") references "supplier" ("id") on delete restrict,
      constraint "fulfillment_group_offer_fk" foreign key ("supplier_offer_id") references "supplier_offer" ("id") on delete restrict);`);
    this.addSql(
      `create index if not exists "IDX_fulfillment_group_plan" on "supplier_fulfillment_group" ("plan_id") where "deleted_at" is null;`,
    );

    this.addSql(`create table if not exists "supplier_order" (
      "id" text primary key, "customer_order_id" text not null, "fulfillment_group_id" text not null,
      "supplier_id" text not null, "supplier_offer_id" text not null, "provider" text not null, "provider_order_id" text null,
      "status" text check ("status" in ('DRAFT','APPROVAL_REQUIRED','APPROVED','SUBMITTING','SUBMITTED','CONFIRMED','REJECTED','CANCELLED','FAILED','SHIPPED','DELIVERED','EXCEPTION')) not null default 'APPROVAL_REQUIRED',
      "currency" text not null, "expected_product_cost" text not null, "expected_shipping_cost" text not null,
      "expected_total" text not null, "actual_total" text null, "sandbox" boolean not null default true,
      "approved_by" text null, "approved_at" timestamptz null, "submitted_at" timestamptz null,
      "confirmed_at" timestamptz null, "shipped_at" timestamptz null, "delivered_at" timestamptz null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "supplier_order_customer_order_fk" foreign key ("customer_order_id") references "customer_order" ("id") on delete restrict,
      constraint "supplier_order_group_fk" foreign key ("fulfillment_group_id") references "supplier_fulfillment_group" ("id") on delete restrict);`);
    this.addSql(
      `create unique index if not exists "IDX_supplier_order_active_group_unique" on "supplier_order" ("fulfillment_group_id") where "deleted_at" is null and "status" not in ('REJECTED','CANCELLED','FAILED');`,
    );
    this.addSql(
      `create index if not exists "IDX_supplier_order_customer" on "supplier_order" ("customer_order_id") where "deleted_at" is null;`,
    );

    this.addSql(`create table if not exists "fulfillment_tracking" (
      "id" text primary key, "supplier_order_id" text not null, "carrier" text not null, "tracking_number" text not null,
      "tracking_url" text null, "status" text check ("status" in ('LABEL_CREATED','IN_TRANSIT','CUSTOMS','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','UNKNOWN')) not null default 'UNKNOWN',
      "provider" text not null, "sandbox" boolean not null default true, "last_event_at" timestamptz not null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "tracking_supplier_order_fk" foreign key ("supplier_order_id") references "supplier_order" ("id") on delete restrict);`);
    this.addSql(
      `create unique index if not exists "IDX_tracking_supplier_order_unique" on "fulfillment_tracking" ("supplier_order_id") where "deleted_at" is null;`,
    );

    this.addSql(`create table if not exists "order_exception" (
      "id" text primary key, "customer_order_id" text not null, "fulfillment_group_id" text null,
      "type" text check ("type" in ('OUT_OF_STOCK','PRICE_CHANGED','SHIPPING_CHANGED','PROVIDER_UNAVAILABLE','ADDRESS_PROBLEM','COMPLIANCE_HOLD','MARGIN_TOO_LOW','TRACKING_DELAY','SUPPLIER_REJECTED','UNKNOWN')) not null,
      "severity" text check ("severity" in ('INFO','WARNING','ACTION_REQUIRED','BLOCKING')) not null,
      "status" text check ("status" in ('OPEN','ACKNOWLEDGED','RESOLVED')) not null default 'OPEN',
      "message" text not null, "details" jsonb null, "acknowledged_by" text null, "acknowledged_at" timestamptz null,
      "resolved_by" text null, "resolved_at" timestamptz null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "order_exception_customer_order_fk" foreign key ("customer_order_id") references "customer_order" ("id") on delete restrict);`);
    this.addSql(
      `create index if not exists "IDX_order_exception_order" on "order_exception" ("customer_order_id") where "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "order_exception" cascade;`);
    this.addSql(`drop table if exists "fulfillment_tracking" cascade;`);
    this.addSql(`drop table if exists "supplier_order" cascade;`);
    this.addSql(`drop table if exists "supplier_fulfillment_group" cascade;`);
    this.addSql(`drop table if exists "supplier_fulfillment_plan" cascade;`);
    this.addSql(`drop table if exists "customer_order" cascade;`);
    this.addSql(`drop sequence if exists "achilles_order_reference_seq";`);
  }
}
