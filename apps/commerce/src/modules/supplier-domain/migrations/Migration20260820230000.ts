import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820230000 extends Migration {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async up(): Promise<void> {
    this.addSql(
      `alter table "checkout_session" drop constraint if exists "checkout_session_status_check";`,
    );
    this.addSql(
      `alter table "checkout_session" add constraint "checkout_session_status_check" check ("status" in ('CART','CUSTOMER','ADDRESS','SHIPPING','REVIEW','READY_FOR_PAYMENT','PAYMENT_PENDING','PAID','PAYMENT_FAILED','EXPIRED_SHIPPING','REQUOTE_REQUIRED','BLOCKED','ERROR'));`,
    );
    this.addSql(`create table if not exists "taxpayer_identity" (
      "id" text primary key, "type" text check ("type" in ('CPF','CNPJ','PASSPORT_FUTURE')) not null,
      "normalized_value" text not null, "country" text not null default 'BR', "purpose" text not null,
      "verified_format" boolean not null default false, "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`);
    this.addSql(
      `create index if not exists "IDX_taxpayer_identity_value" on "taxpayer_identity" ("type", "normalized_value") where "deleted_at" is null;`,
    );
    this.addSql(`create table if not exists "payment_intent" (
      "id" text primary key, "checkout_session_id" text not null, "taxpayer_identity_id" text null,
      "provider" text check ("provider" in ('MERCADO_PAGO','TEST')) not null,
      "provider_order_id" text null, "method" text check ("method" in ('PIX','CARD','BOLETO')) not null,
      "amount" text not null, "currency" text not null default 'BRL',
      "status" text check ("status" in ('CREATED','PENDING','PROCESSING','PAID','FAILED','CANCELLED','EXPIRED','REFUNDED')) not null default 'CREATED',
      "idempotency_key" text not null, "external_reference" text not null, "provider_status" text null,
      "failure_code" text null, "failure_message_safe" text null, "display_data" jsonb null,
      "expires_at" timestamptz null, "paid_at" timestamptz null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "payment_intent_checkout_fk" foreign key ("checkout_session_id") references "checkout_session" ("id") on delete restrict,
      constraint "payment_intent_taxpayer_fk" foreign key ("taxpayer_identity_id") references "taxpayer_identity" ("id") on delete restrict);`);
    this.addSql(
      `create unique index if not exists "IDX_payment_intent_idempotency_unique" on "payment_intent" ("idempotency_key") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_payment_intent_checkout" on "payment_intent" ("checkout_session_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_payment_intent_provider_order" on "payment_intent" ("provider_order_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_payment_intent_status" on "payment_intent" ("status") where "deleted_at" is null;`,
    );
    this.addSql(`create table if not exists "payment_provider_event" (
      "id" text primary key, "provider" text check ("provider" in ('MERCADO_PAGO','TEST')) not null,
      "provider_event_id" text not null, "payment_intent_id" text null, "type" text not null,
      "received_at" timestamptz not null, "processed_at" timestamptz null,
      "status" text check ("status" in ('RECEIVED','PROCESSED','IGNORED','FAILED')) not null default 'RECEIVED',
      "sanitized_payload_reference" text not null, "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "payment_event_intent_fk" foreign key ("payment_intent_id") references "payment_intent" ("id") on delete set null);`);
    this.addSql(
      `create unique index if not exists "IDX_payment_event_provider_unique" on "payment_provider_event" ("provider", "provider_event_id") where "deleted_at" is null;`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_provider_event" cascade;`);
    this.addSql(`drop table if exists "payment_intent" cascade;`);
    this.addSql(`drop table if exists "taxpayer_identity" cascade;`);
    this.addSql(
      `alter table "checkout_session" drop constraint if exists "checkout_session_status_check";`,
    );
    this.addSql(
      `alter table "checkout_session" add constraint "checkout_session_status_check" check ("status" in ('CART','CUSTOMER','ADDRESS','SHIPPING','REVIEW','READY_FOR_PAYMENT','EXPIRED_SHIPPING','REQUOTE_REQUIRED','BLOCKED','ERROR'));`,
    );
  }
}
