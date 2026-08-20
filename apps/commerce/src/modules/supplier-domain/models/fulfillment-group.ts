import { model } from "@medusajs/framework/utils";

const FulfillmentGroup = model
  .define("supplier_fulfillment_group", {
    id: model.id({ prefix: "fulgrp" }).primaryKey(),
    plan_id: model.text(),
    supplier_id: model.text(),
    supplier_offer_id: model.text(),
    provider: model.text(),
    fulfillment_mode: model.enum([
      "PRIVATE_LABEL_DROPSHIP",
      "GENERIC_DROPSHIP",
      "BRAZIL_STOCK",
    ]),
    items_snapshot: model.json(),
    shipping_quote_snapshot: model.json(),
    routing_snapshot: model.json(),
    approval_fingerprint: model.text().nullable(),
  })
  .indexes([{ on: ["plan_id"] }, { on: ["supplier_offer_id"] }]);

export default FulfillmentGroup;
