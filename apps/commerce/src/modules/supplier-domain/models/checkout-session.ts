import { model } from "@medusajs/framework/utils";

const CheckoutSession = model
  .define("checkout_session", {
    id: model.id({ prefix: "checkout" }).primaryKey(),
    cart_id: model.text(),
    email: model.text().nullable(),
    customer_name: model.text().nullable(),
    phone: model.text().nullable(),
    destination: model.json().nullable(),
    shipping_groups: model.json().default({ items: [] }),
    selected_shipping: model.json().default({ items: [] }),
    totals_snapshot: model.json().nullable(),
    cart_snapshot: model.json().nullable(),
    cart_fingerprint: model.text().nullable(),
    address_fingerprint: model.text().nullable(),
    status: model
      .enum([
        "CART",
        "CUSTOMER",
        "ADDRESS",
        "SHIPPING",
        "REVIEW",
        "READY_FOR_PAYMENT",
        "PAYMENT_PENDING",
        "PAID",
        "PAYMENT_FAILED",
        "EXPIRED_SHIPPING",
        "REQUOTE_REQUIRED",
        "BLOCKED",
        "ERROR",
      ])
      .default("CART"),
    version: model.number().default(1),
    expires_at: model.dateTime(),
    ready_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_checkout_session_cart_unique",
      on: ["cart_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["status"] },
    { on: ["expires_at"] },
  ]);

export default CheckoutSession;
