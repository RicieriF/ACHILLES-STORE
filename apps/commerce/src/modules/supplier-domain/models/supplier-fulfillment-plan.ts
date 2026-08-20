import { model } from "@medusajs/framework/utils";

const SupplierFulfillmentPlan = model
  .define("supplier_fulfillment_plan", {
    id: model.id({ prefix: "supplan" }).primaryKey(),
    customer_order_id: model.text(),
    status: model
      .enum([
        "NOT_READY",
        "REVIEW_REQUIRED",
        "APPROVAL_REQUIRED",
        "APPROVED",
        "BLOCKED",
        "STALE",
        "EXCEPTION",
      ])
      .default("NOT_READY"),
    version: model.number().default(1),
    revenue_brl: model.text(),
    approved_margin_brl: model.text().nullable(),
    approved_at: model.dateTime().nullable(),
    approved_by: model.text().nullable(),
    approval_snapshot: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_supplier_plan_order_unique",
      on: ["customer_order_id"],
      unique: true,
    },
    { on: ["status"] },
  ]);

export default SupplierFulfillmentPlan;
