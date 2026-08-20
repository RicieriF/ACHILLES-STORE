import { model } from "@medusajs/framework/utils";

const PaymentProviderEvent = model
  .define("payment_provider_event", {
    id: model.id({ prefix: "payevt" }).primaryKey(),
    provider: model.enum(["MERCADO_PAGO", "TEST"]),
    provider_event_id: model.text(),
    payment_intent_id: model.text().nullable(),
    type: model.text(),
    received_at: model.dateTime(),
    processed_at: model.dateTime().nullable(),
    status: model
      .enum(["RECEIVED", "PROCESSED", "IGNORED", "FAILED"])
      .default("RECEIVED"),
    sanitized_payload_reference: model.text(),
  })
  .indexes([
    {
      name: "IDX_payment_event_provider_unique",
      on: ["provider", "provider_event_id"],
      unique: true,
    },
  ]);

export default PaymentProviderEvent;
