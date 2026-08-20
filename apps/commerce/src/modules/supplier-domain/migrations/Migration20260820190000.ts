import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820190000 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "checkout_session" (
      "id" text not null, "cart_id" text not null, "email" text null,
      "customer_name" text null, "phone" text null, "destination" jsonb null,
      "shipping_groups" jsonb not null default '{"items":[]}',
      "selected_shipping" jsonb not null default '{"items":[]}',
      "totals_snapshot" jsonb null, "cart_snapshot" jsonb null,
      "cart_fingerprint" text null, "address_fingerprint" text null,
      "status" text check ("status" in ('CART','CUSTOMER','ADDRESS','SHIPPING','REVIEW','READY_FOR_PAYMENT','EXPIRED_SHIPPING','REQUOTE_REQUIRED','BLOCKED','ERROR')) not null default 'CART',
      "version" integer not null default 1, "expires_at" timestamptz not null,
      "ready_at" timestamptz null, "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "checkout_session_pkey" primary key ("id")
    );`);
    this.addSql(
      `create unique index if not exists "IDX_checkout_session_cart_unique" on "checkout_session" ("cart_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_checkout_session_status" on "checkout_session" ("status") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_checkout_session_expires" on "checkout_session" ("expires_at") where "deleted_at" is null;`,
    );
    this.addSql(`create table if not exists "checkout_shipping_selection" (
      "id" text not null, "checkout_session_id" text not null,
      "shipping_group_id" text not null, "shipping_quote_id" text not null,
      "method_name" text not null, "customer_price_brl" text not null,
      "estimated_min_days" integer not null, "estimated_max_days" integer not null,
      "duties_mode" text check ("duties_mode" in ('DDP','DAP','UNKNOWN')) not null default 'UNKNOWN',
      "expires_at" timestamptz not null, "policy_snapshot" jsonb not null,
      "cart_fingerprint" text not null, "address_fingerprint" text not null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null, constraint "checkout_shipping_selection_pkey" primary key ("id"),
      constraint "checkout_selection_session_fk" foreign key ("checkout_session_id") references "checkout_session" ("id") on delete cascade,
      constraint "checkout_selection_quote_fk" foreign key ("shipping_quote_id") references "shipping_quote" ("id") on update cascade
    );`);
    this.addSql(
      `create unique index if not exists "IDX_checkout_shipping_group_unique" on "checkout_shipping_selection" ("checkout_session_id", "shipping_group_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_checkout_selection_quote" on "checkout_shipping_selection" ("shipping_quote_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_checkout_selection_expires" on "checkout_shipping_selection" ("expires_at") where "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "checkout_shipping_selection" cascade;`);
    this.addSql(`drop table if exists "checkout_session" cascade;`);
  }
}
