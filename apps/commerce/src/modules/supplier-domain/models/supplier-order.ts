import { model } from "@medusajs/framework/utils";

const SupplierOrder = model
  .define("supplier_order", {
    id: model.id({ prefix: "supord" }).primaryKey(),
    customer_order_id: model.text(),
    fulfillment_group_id: model.text(),
    supplier_id: model.text(),
    supplier_offer_id: model.text(),
    provider: model.text(),
    provider_order_id: model.text().nullable(),
    status: model
      .enum([
        "DRAFT",
        "APPROVAL_REQUIRED",
        "APPROVED",
        "SUBMITTING",
        "SUBMITTED",
        "CONFIRMED",
        "REJECTED",
        "CANCELLED",
        "FAILED",
        "SHIPPED",
        "DELIVERED",
        "EXCEPTION",
      ])
      .default("APPROVAL_REQUIRED"),
    currency: model.text(),
    expected_product_cost: model.text(),
    expected_shipping_cost: model.text(),
    expected_total: model.text(),
    actual_total: model.text().nullable(),
    sandbox: model.boolean().default(true),
    approved_by: model.text().nullable(),
    approved_at: model.dateTime().nullable(),
    submitted_at: model.dateTime().nullable(),
    confirmed_at: model.dateTime().nullable(),
    shipped_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_supplier_order_active_group_unique",
      on: ["fulfillment_group_id"],
      unique: true,
    },
    { on: ["customer_order_id"] },
    { on: ["status"] },
  ]);

export default SupplierOrder;
