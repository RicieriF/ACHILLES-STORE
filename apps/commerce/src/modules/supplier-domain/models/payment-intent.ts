import { model } from "@medusajs/framework/utils";

const PaymentIntent = model
  .define("payment_intent", {
    id: model.id({ prefix: "pay" }).primaryKey(),
    checkout_session_id: model.text(),
    taxpayer_identity_id: model.text().nullable(),
    provider: model.enum(["MERCADO_PAGO", "TEST"]),
    provider_order_id: model.text().nullable(),
    method: model.enum(["PIX", "CARD", "BOLETO"]),
    amount: model.text(),
    currency: model.text().default("BRL"),
    status: model
      .enum([
        "CREATED",
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "CANCELLED",
        "EXPIRED",
        "REFUNDED",
      ])
      .default("CREATED"),
    idempotency_key: model.text(),
    external_reference: model.text(),
    provider_status: model.text().nullable(),
    failure_code: model.text().nullable(),
    failure_message_safe: model.text().nullable(),
    display_data: model.json().nullable(),
    expires_at: model.dateTime().nullable(),
    paid_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_payment_intent_idempotency_unique",
      on: ["idempotency_key"],
      unique: true,
    },
    { on: ["checkout_session_id"] },
    { on: ["provider_order_id"] },
    { on: ["status"] },
  ]);

export default PaymentIntent;
