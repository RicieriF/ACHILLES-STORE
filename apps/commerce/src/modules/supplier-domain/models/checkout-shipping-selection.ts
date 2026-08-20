import { model } from "@medusajs/framework/utils";

const CheckoutShippingSelection = model
  .define("checkout_shipping_selection", {
    id: model.id({ prefix: "checkoutship" }).primaryKey(),
    checkout_session_id: model.text(),
    shipping_group_id: model.text(),
    shipping_quote_id: model.text(),
    method_name: model.text(),
    customer_price_brl: model.text(),
    estimated_min_days: model.number(),
    estimated_max_days: model.number(),
    duties_mode: model.enum(["DDP", "DAP", "UNKNOWN"]).default("UNKNOWN"),
    expires_at: model.dateTime(),
    policy_snapshot: model.json(),
    cart_fingerprint: model.text(),
    address_fingerprint: model.text(),
  })
  .indexes([
    {
      name: "IDX_checkout_shipping_group_unique",
      on: ["checkout_session_id", "shipping_group_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["shipping_quote_id"] },
    { on: ["expires_at"] },
  ]);

export default CheckoutShippingSelection;
