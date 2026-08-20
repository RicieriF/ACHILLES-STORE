import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820040000 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "import_draft" (
      "id" text not null, "provider" text not null, "source_url" text not null,
      "canonical_source_url" text not null, "supplier_product_id" text null,
      "status" text check ("status" in ('FETCHING','PARSED','NEEDS_REVIEW','APPROVED','REJECTED','FAILED')) not null default 'NEEDS_REVIEW',
      "title_raw" text null, "title_normalized" text null, "description_raw" text null, "description_normalized" text null,
      "source_currency" text null, "source_price_min" text null, "source_price_max" text null, "moq" integer null,
      "category_raw" text null, "category_suggested" text null,
      "media" jsonb not null default '{"items":[]}', "specifications" jsonb not null default '{}', "variants" jsonb not null default '{"items":[]}',
      "supplier_snapshot" jsonb null, "raw_provider_metadata" jsonb null,
      "compliance_status" text check ("compliance_status" in ('CLEAR','REVIEW_REQUIRED','BLOCKED')) not null default 'CLEAR',
      "alerts" jsonb not null default '{"items":[]}', "failure_reason" text null, "created_by" text null, "last_fetch_at" timestamptz null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "import_draft_pkey" primary key ("id"));`);
    this.addSql(
      `create index if not exists "IDX_import_draft_url" on "import_draft" ("canonical_source_url") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_import_draft_product" on "import_draft" ("provider", "supplier_product_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_import_draft_status" on "import_draft" ("status") where "deleted_at" is null;`,
    );
    this.addSql(`create table if not exists "import_attempt" (
      "id" text not null, "import_draft_id" text not null, "source_url" text not null, "canonical_url" text not null,
      "provider" text not null, "result" text not null, "method" text not null, "essential_data" jsonb null,
      "error_code" text null, "error_message" text null, "parser_version" text not null, "normalizer_version" text not null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "import_attempt_pkey" primary key ("id"));`);
    this.addSql(
      `create index if not exists "IDX_import_attempt_draft" on "import_attempt" ("import_draft_id", "created_at") where "deleted_at" is null;`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "import_attempt" cascade;`);
    this.addSql(`drop table if exists "import_draft" cascade;`);
  }
}
