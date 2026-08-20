import { model } from "@medusajs/framework/utils";

const CustomerOrder = model
  .define("customer_order", {
    id: model.id({ prefix: "achord" }).primaryKey(),
    medusa_order_id: model.text(),
    payment_intent_id: model.text(),
    checkout_session_id: model.text(),
    reference: model.text(),
    access_token_hash: model.text(),
    status: model
      .enum([
        "PAYMENT_PENDING",
        "PAID",
        "FULFILLMENT_REVIEW",
        "SUPPLIER_APPROVAL_REQUIRED",
        "SUPPLIER_APPROVED",
        "ORDERING_SUPPLIER",
        "SUPPLIER_CONFIRMED",
        "IN_FULFILLMENT",
        "SHIPPED",
        "DELIVERED",
        "EXCEPTION",
        "CANCELLED",
      ])
      .default("PAID"),
    currency: model.text().default("BRL"),
    total_paid: model.text(),
    customer_snapshot: model.json(),
    address_snapshot: model.json(),
    items_snapshot: model.json(),
    shipping_snapshot: model.json(),
  })
  .indexes([
    {
      name: "IDX_customer_order_medusa_unique",
      on: ["medusa_order_id"],
      unique: true,
    },
    {
      name: "IDX_customer_order_payment_unique",
      on: ["payment_intent_id"],
      unique: true,
    },
    {
      name: "IDX_customer_order_reference_unique",
      on: ["reference"],
      unique: true,
    },
    { on: ["status"] },
  ]);

export default CustomerOrder;
