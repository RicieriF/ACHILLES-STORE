import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820050000 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "import_draft" add column if not exists "converted_product_id" text null, add column if not exists "conversion_status" text check ("conversion_status" in ('NOT_STARTED','IN_PROGRESS','COMPLETED','FAILED')) not null default 'NOT_STARTED', add column if not exists "conversion_started_at" timestamptz null, add column if not exists "conversion_completed_at" timestamptz null, add column if not exists "conversion_failure_reason" text null;`,
    );
    this.addSql(
      `create unique index if not exists "IDX_import_draft_converted_product_unique" on "import_draft" ("converted_product_id") where "converted_product_id" is not null and "deleted_at" is null;`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" add column if not exists "canonical_source_url" text null, add column if not exists "import_draft_id" text null, add column if not exists "unit_cost_max" text null;`,
    );
    this.addSql(
      `create unique index if not exists "IDX_supplier_offer_import_draft_unique" on "supplier_offer" ("import_draft_id") where "import_draft_id" is not null and "deleted_at" is null;`,
    );
    this.addSql(
      `alter table if exists "product_policy" add column if not exists "commercial_readiness" text check ("commercial_readiness" in ('DATA_INCOMPLETE','PRICING_REQUIRED','COMPLIANCE_REQUIRED','READY_FOR_REVIEW','BLOCKED')) not null default 'DATA_INCOMPLETE', add column if not exists "import_draft_id" text null;`,
    );
    this.addSql(
      `create index if not exists "IDX_product_policy_commercial_readiness" on "product_policy" ("commercial_readiness") where "deleted_at" is null;`,
    );
    this.addSql(
      `create table if not exists "cost_quote" ("id" text not null, "status" text check ("status" in ('INCOMPLETE','READY_FOR_PRICING','PRICED','STALE')) not null default 'INCOMPLETE', "source_currency" text not null, "supplier_unit_cost" text not null, "supplier_unit_cost_max" text null, "moq" integer not null, "fx_rate" text null, "fx_source" text null, "fx_captured_at" timestamptz null, "international_freight" text null, "customs_tax" text null, "branding_cost" text null, "payment_fee" text null, "local_delivery" text null, "risk_reserve" text null, "target_margin" text null, "assumptions" jsonb not null default '{"items":[]}', "supplier_offer_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cost_quote_pkey" primary key ("id"), constraint "cost_quote_supplier_offer_id_foreign" foreign key ("supplier_offer_id") references "supplier_offer" ("id") on update cascade);`,
    );
    this.addSql(
      `create unique index if not exists "IDX_cost_quote_offer_unique" on "cost_quote" ("supplier_offer_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_cost_quote_status" on "cost_quote" ("status") where "deleted_at" is null;`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cost_quote" cascade;`);
    this.addSql(
      `alter table if exists "product_policy" drop column if exists "commercial_readiness", drop column if exists "import_draft_id";`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" drop column if exists "canonical_source_url", drop column if exists "import_draft_id", drop column if exists "unit_cost_max";`,
    );
    this.addSql(
      `alter table if exists "import_draft" drop column if exists "converted_product_id", drop column if exists "conversion_status", drop column if exists "conversion_started_at", drop column if exists "conversion_completed_at", drop column if exists "conversion_failure_reason";`,
    );
  }
}
