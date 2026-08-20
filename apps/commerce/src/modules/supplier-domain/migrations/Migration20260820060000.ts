import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820060000 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cost_quote"
      add column if not exists "international_shipping_allocation_method" text check ("international_shipping_allocation_method" in ('PER_UNIT','BY_QUANTITY','MANUAL')) null,
      add column if not exists "shipping_allocation_quantity" integer null,
      add column if not exists "customs_strategy" text check ("customs_strategy" in ('CUSTOMER_AS_IMPORTER','MERCHANT_AS_IMPORTER','MANUAL_QUOTE')) null,
      add column if not exists "branding_setup_cost" text null,
      add column if not exists "branding_setup_allocation" integer null,
      add column if not exists "payment_gateway_percent" text null,
      add column if not exists "payment_gateway_provider" text null,
      add column if not exists "returns_risk_reserve_percent" text null,
      add column if not exists "operational_reserve" text null,
      add column if not exists "operational_reserve_percent" text null,
      add column if not exists "promotional_buffer" text null,
      add column if not exists "landed_cost" text null,
      add column if not exists "break_even_price" text null,
      add column if not exists "suggested_retail_price" text null,
      add column if not exists "gross_margin_percent" text null,
      add column if not exists "contribution_margin" text null,
      add column if not exists "warnings" jsonb not null default '{"items":[]}',
      add column if not exists "calculated_at" timestamptz null,
      add column if not exists "approved_at" timestamptz null,
      add column if not exists "approved_by" text null,
      add column if not exists "approved_retail_price" text null,
      add column if not exists "approved_snapshot_id" text null;`);
    this.addSql(`create table if not exists "pricing_snapshot" (
      "id" text not null,
      "version" integer not null,
      "engine_version" text not null,
      "inputs" jsonb not null,
      "outputs" jsonb not null,
      "assumptions" jsonb not null default '{"items":[]}',
      "warnings" jsonb not null default '{"items":[]}',
      "fx_rate" text not null,
      "fx_source" text not null,
      "fx_timestamp" timestamptz not null,
      "customs_strategy" text not null,
      "calculated_by" text null,
      "calculated_at" timestamptz not null,
      "approved_by" text null,
      "approved_at" timestamptz null,
      "approved_retail_price" text null,
      "cost_quote_id" text not null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "pricing_snapshot_pkey" primary key ("id"),
      constraint "pricing_snapshot_cost_quote_id_foreign" foreign key ("cost_quote_id") references "cost_quote" ("id") on update cascade
    );`);
    this.addSql(
      `create unique index if not exists "IDX_pricing_snapshot_quote_version" on "pricing_snapshot" ("cost_quote_id", "version");`,
    );
    this.addSql(
      `create index if not exists "IDX_pricing_snapshot_cost_quote" on "pricing_snapshot" ("cost_quote_id") where "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pricing_snapshot" cascade;`);
    this.addSql(`alter table if exists "cost_quote"
      drop column if exists "international_shipping_allocation_method",
      drop column if exists "shipping_allocation_quantity",
      drop column if exists "customs_strategy",
      drop column if exists "branding_setup_cost",
      drop column if exists "branding_setup_allocation",
      drop column if exists "payment_gateway_percent",
      drop column if exists "payment_gateway_provider",
      drop column if exists "returns_risk_reserve_percent",
      drop column if exists "operational_reserve",
      drop column if exists "operational_reserve_percent",
      drop column if exists "promotional_buffer",
      drop column if exists "landed_cost",
      drop column if exists "break_even_price",
      drop column if exists "suggested_retail_price",
      drop column if exists "gross_margin_percent",
      drop column if exists "contribution_margin",
      drop column if exists "warnings",
      drop column if exists "calculated_at",
      drop column if exists "approved_at",
      drop column if exists "approved_by",
      drop column if exists "approved_retail_price",
      drop column if exists "approved_snapshot_id";`);
  }
}
