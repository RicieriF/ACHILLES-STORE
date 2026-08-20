import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820020000 extends Migration {
  // MikroORM's migration contract requires an async method even though addSql queues statements.
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "supplier" ("id" text not null, "name" text not null, "provider" text not null, "status" text check ("status" in ('ACTIVE', 'INACTIVE')) not null default 'ACTIVE', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_provider" ON "supplier" ("provider") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_provider_name_unique" ON "supplier" ("provider", "name") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_deleted_at" ON "supplier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "branding_profile" ("id" text not null, "name" text not null, "brand_name" text not null, "logo_asset_reference" text null, "packaging_instructions" text null, "insert_instructions" text null, "language" text not null default 'pt-BR', "customization_notes" text null, "branding_moq" numeric null, "setup_cost" text null, "per_unit_branding_cost" text null, "currency" text not null default 'USD', "lead_time_days" numeric null, "supplier_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branding_profile_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branding_profile_supplier_id" ON "branding_profile" ("supplier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branding_profile_deleted_at" ON "branding_profile" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "supplier_offer" ("id" text not null, "product_id" text not null, "supplier_product_id" text not null, "source_url" text not null, "currency" text not null, "unit_cost" text not null, "moq" numeric not null default 1, "availability" text check ("availability" in ('UNKNOWN', 'IN_STOCK', 'OUT_OF_STOCK')) not null default 'UNKNOWN', "availability_quantity" numeric null, "private_label_supported" boolean not null default false, "branding_moq" numeric null, "is_primary" boolean not null default false, "freight_metadata" jsonb null, "last_sync_at" timestamptz null, "sync_status" text check ("sync_status" in ('NEVER_SYNCED', 'SYNCED', 'STALE', 'FAILED')) not null default 'NEVER_SYNCED', "raw_source_reference" text null, "supplier_id" text not null, "branding_profile_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_offer_pkey" primary key ("id"), constraint "supplier_offer_moq_positive" check ("moq" > 0));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_product_id" ON "supplier_offer" ("product_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_supplier_id" ON "supplier_offer" ("supplier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_branding_profile_id" ON "supplier_offer" ("branding_profile_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_offer_external_unique" ON "supplier_offer" ("supplier_id", "supplier_product_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_offer_primary_unique" ON "supplier_offer" ("product_id") WHERE is_primary = true AND deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_deleted_at" ON "supplier_offer" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "supplier_variant_map" ("id" text not null, "store_variant_id" text not null, "supplier_sku" text not null, "supplier_variant_id" text null, "attributes" jsonb null, "supplier_offer_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_variant_map_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_variant_map_store_variant_id" ON "supplier_variant_map" ("store_variant_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_variant_map_supplier_offer_id" ON "supplier_variant_map" ("supplier_offer_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_variant_map_unique" ON "supplier_variant_map" ("supplier_offer_id", "store_variant_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_variant_map_deleted_at" ON "supplier_variant_map" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "product_policy" ("id" text not null, "product_id" text not null, "fulfillment_mode" text check ("fulfillment_mode" in ('PRIVATE_LABEL_DROPSHIP', 'GENERIC_DROPSHIP', 'BRAZIL_STOCK')) not null default 'PRIVATE_LABEL_DROPSHIP', "compliance_status" text check ("compliance_status" in ('PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'BLOCKED')) not null default 'PENDING', "sensitivity" text check ("sensitivity" in ('ORDINARY', 'EDGED_TOOL', 'CONTROLLED_ITEM')) not null default 'ORDINARY', "compliance_notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_policy_pkey" primary key ("id"), constraint "product_policy_sensitive_auto_approval" check ("sensitivity" = 'ORDINARY' or ("sensitivity" = 'EDGED_TOOL' and "compliance_status" in ('REVIEW_REQUIRED', 'BLOCKED')) or ("sensitivity" = 'CONTROLLED_ITEM' and "compliance_status" = 'BLOCKED')));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_policy_product_unique" ON "product_policy" ("product_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_policy_compliance_status" ON "product_policy" ("compliance_status") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_policy_deleted_at" ON "product_policy" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "branding_profile" add constraint "branding_profile_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" add constraint "supplier_offer_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" add constraint "supplier_offer_branding_profile_id_foreign" foreign key ("branding_profile_id") references "branding_profile" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table if exists "supplier_variant_map" add constraint "supplier_variant_map_supplier_offer_id_foreign" foreign key ("supplier_offer_id") references "supplier_offer" ("id") on update cascade on delete cascade;`,
    );
  }

  // MikroORM's migration contract requires an async method even though addSql queues statements.
  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "supplier_variant_map" cascade;`);
    this.addSql(`drop table if exists "supplier_offer" cascade;`);
    this.addSql(`drop table if exists "branding_profile" cascade;`);
    this.addSql(`drop table if exists "product_policy" cascade;`);
    this.addSql(`drop table if exists "supplier" cascade;`);
  }
}
