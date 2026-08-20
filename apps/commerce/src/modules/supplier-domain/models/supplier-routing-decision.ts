import { model } from "@medusajs/framework/utils";

const SupplierRoutingDecision = model
  .define("supplier_routing_decision", {
    id: model.id({ prefix: "route" }).primaryKey(),
    cart_id: model.text().nullable(),
    product_id: model.text(),
    variant_id: model.text(),
    destination_country: model.text(),
    postal_code: model.text(),
    selected_supplier_offer_id: model.text().nullable(),
    selected_shipping_quote_id: model.text().nullable(),
    candidates: model.json().default({ items: [] }),
    scores: model.json().default({}),
    reasons: model.json().default({ items: [] }),
    quote_references: model.json().default({ items: [] }),
    decided_at: model.dateTime(),
  })
  .indexes([
    { on: ["cart_id"] },
    { on: ["product_id", "variant_id"] },
    { on: ["decided_at"] },
  ]);

export default SupplierRoutingDecision;
