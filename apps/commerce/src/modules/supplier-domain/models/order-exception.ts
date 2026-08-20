import { model } from "@medusajs/framework/utils";

const OrderException = model
  .define("order_exception", {
    id: model.id({ prefix: "ordexc" }).primaryKey(),
    customer_order_id: model.text(),
    fulfillment_group_id: model.text().nullable(),
    type: model.enum([
      "OUT_OF_STOCK",
      "PRICE_CHANGED",
      "SHIPPING_CHANGED",
      "PROVIDER_UNAVAILABLE",
      "ADDRESS_PROBLEM",
      "COMPLIANCE_HOLD",
      "MARGIN_TOO_LOW",
      "TRACKING_DELAY",
      "SUPPLIER_REJECTED",
      "UNKNOWN",
    ]),
    severity: model.enum(["INFO", "WARNING", "ACTION_REQUIRED", "BLOCKING"]),
    status: model.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).default("OPEN"),
    message: model.text(),
    details: model.json().nullable(),
    acknowledged_by: model.text().nullable(),
    acknowledged_at: model.dateTime().nullable(),
    resolved_by: model.text().nullable(),
    resolved_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["customer_order_id"] }, { on: ["status", "severity"] }]);

export default OrderException;
