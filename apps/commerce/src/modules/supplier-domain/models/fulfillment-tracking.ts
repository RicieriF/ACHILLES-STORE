import { model } from "@medusajs/framework/utils";

const FulfillmentTracking = model
  .define("fulfillment_tracking", {
    id: model.id({ prefix: "track" }).primaryKey(),
    supplier_order_id: model.text(),
    carrier: model.text(),
    tracking_number: model.text(),
    tracking_url: model.text().nullable(),
    status: model
      .enum([
        "LABEL_CREATED",
        "IN_TRANSIT",
        "CUSTOMS",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "EXCEPTION",
        "UNKNOWN",
      ])
      .default("UNKNOWN"),
    provider: model.text(),
    sandbox: model.boolean().default(true),
    last_event_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_tracking_supplier_order_unique",
      on: ["supplier_order_id"],
      unique: true,
    },
    { on: ["tracking_number"] },
  ]);

export default FulfillmentTracking;
