import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820151852 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "shipping_quote" (
      "id" text not null,
      "cart_id" text null,
      "product_id" text not null,
      "variant_id" text not null,
      "supplier_offer_id" text not null,
      "provider" text not null,
      "destination_country" text not null,
      "destination_state" text null,
      "destination_city" text null,
      "postal_code" text not null,
      "quantity" integer not null,
      "provider_service_code" text not null,
      "method_name" text not null,
      "currency" text not null,
      "provider_amount" text not null,
      "normalized_amount_brl" text null,
      "fx_rate" text null,
      "fx_source" text null,
      "fx_captured_at" timestamptz null,
      "estimated_min_days" integer not null,
      "estimated_max_days" integer not null,
      "estimate_source" text not null,
      "duties_mode" text check ("duties_mode" in ('DDP','DAP','UNKNOWN')) not null default 'UNKNOWN',
      "tracking_supported" boolean not null default false,
      "expires_at" timestamptz not null,
      "status" text check ("status" in ('VALID','EXPIRED','UNAVAILABLE','FAILED')) not null default 'VALID',
      "warnings" jsonb not null default '{"items":[]}',
      "assumptions" jsonb not null default '{"items":[]}',
      "provider_reference" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "shipping_quote_pkey" primary key ("id"),
      constraint "shipping_quote_supplier_offer_id_foreign" foreign key ("supplier_offer_id") references "supplier_offer" ("id") on update cascade
    );`);
    this.addSql(
      `create index if not exists "IDX_shipping_quote_supplier_offer_id" on "shipping_quote" ("supplier_offer_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_shipping_quote_deleted_at" on "shipping_quote" ("deleted_at") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_shipping_quote_cart_id" on "shipping_quote" ("cart_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_shipping_quote_product_variant" on "shipping_quote" ("product_id", "variant_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_shipping_quote_postal_code" on "shipping_quote" ("postal_code") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_shipping_quote_status_expires" on "shipping_quote" ("status", "expires_at") where "deleted_at" is null;`,
    );

    this.addSql(`create table if not exists "supplier_routing_decision" (
      "id" text not null,
      "cart_id" text null,
      "product_id" text not null,
      "variant_id" text not null,
      "destination_country" text not null,
      "postal_code" text not null,
      "selected_supplier_offer_id" text null,
      "selected_shipping_quote_id" text null,
      "candidates" jsonb not null default '{"items":[]}',
      "scores" jsonb not null default '{}',
      "reasons" jsonb not null default '{"items":[]}',
      "quote_references" jsonb not null default '{"items":[]}',
      "decided_at" timestamptz not null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "supplier_routing_decision_pkey" primary key ("id")
    );`);
    this.addSql(
      `create index if not exists "IDX_routing_decision_deleted_at" on "supplier_routing_decision" ("deleted_at") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_routing_decision_cart_id" on "supplier_routing_decision" ("cart_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_routing_decision_product_variant" on "supplier_routing_decision" ("product_id", "variant_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_routing_decision_decided_at" on "supplier_routing_decision" ("decided_at") where "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "supplier_routing_decision" cascade;`);
    this.addSql(`drop table if exists "shipping_quote" cascade;`);
  }
}
