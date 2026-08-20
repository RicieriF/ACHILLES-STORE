import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820030000 extends Migration {
  // MikroORM requires an async migration contract even though addSql is synchronous.
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier" add column if not exists "country_code" text not null default 'CN', add column if not exists "contact_name" text null, add column if not exists "contact_email" text null, add column if not exists "contact_phone" text null, add column if not exists "notes" text null;`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" add column if not exists "status" text check ("status" in ('ACTIVE', 'INACTIVE')) not null default 'ACTIVE', add column if not exists "fulfillment_mode" text check ("fulfillment_mode" in ('PRIVATE_LABEL_DROPSHIP', 'GENERIC_DROPSHIP', 'BRAZIL_STOCK')) not null default 'PRIVATE_LABEL_DROPSHIP', add column if not exists "branding_lead_time_days" integer null, add column if not exists "notes" text null;`,
    );
    this.addSql(
      `create index if not exists "IDX_supplier_offer_status" on "supplier_offer" ("status") where "deleted_at" is null;`,
    );
    this.addSql(
      `alter table if exists "product_policy" add column if not exists "reviewed_by" text null, add column if not exists "reviewed_at" timestamptz null;`,
    );
    this.addSql(
      `create table if not exists "audit_event" ("id" text not null, "action" text not null, "entity_type" text not null, "entity_id" text not null, "actor_id" text null, "summary" text not null, "before" jsonb null, "after" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "audit_event_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index if not exists "IDX_audit_event_entity" on "audit_event" ("entity_type", "entity_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_audit_event_action" on "audit_event" ("action") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_audit_event_created_at" on "audit_event" ("created_at") where "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "audit_event" cascade;`);
    this.addSql(
      `alter table if exists "product_policy" drop column if exists "reviewed_by", drop column if exists "reviewed_at";`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" drop column if exists "status", drop column if exists "fulfillment_mode", drop column if exists "branding_lead_time_days", drop column if exists "notes";`,
    );
    this.addSql(
      `alter table if exists "supplier" drop column if exists "country_code", drop column if exists "contact_name", drop column if exists "contact_email", drop column if exists "contact_phone", drop column if exists "notes";`,
    );
  }
}
