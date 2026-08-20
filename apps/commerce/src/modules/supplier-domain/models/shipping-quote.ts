import { model } from "@medusajs/framework/utils";
import SupplierOffer from "./supplier-offer";

const ShippingQuote = model
  .define("shipping_quote", {
    id: model.id({ prefix: "shipq" }).primaryKey(),
    cart_id: model.text().nullable(),
    product_id: model.text(),
    variant_id: model.text(),
    supplier_offer: model.belongsTo(() => SupplierOffer, {
      mappedBy: "shipping_quotes",
    }),
    provider: model.text(),
    destination_country: model.text(),
    destination_state: model.text().nullable(),
    destination_city: model.text().nullable(),
    postal_code: model.text(),
    quantity: model.number(),
    provider_service_code: model.text(),
    method_name: model.text(),
    currency: model.text(),
    provider_amount: model.text(),
    normalized_amount_brl: model.text().nullable(),
    fx_rate: model.text().nullable(),
    fx_source: model.text().nullable(),
    fx_captured_at: model.dateTime().nullable(),
    estimated_min_days: model.number(),
    estimated_max_days: model.number(),
    estimate_source: model.text(),
    duties_mode: model.enum(["DDP", "DAP", "UNKNOWN"]).default("UNKNOWN"),
    tracking_supported: model.boolean().default(false),
    expires_at: model.dateTime(),
    status: model
      .enum(["VALID", "EXPIRED", "UNAVAILABLE", "FAILED"])
      .default("VALID"),
    warnings: model.json().default({ items: [] }),
    assumptions: model.json().default({ items: [] }),
    provider_reference: model.text().nullable(),
  })
  .indexes([
    { on: ["cart_id"] },
    { on: ["product_id", "variant_id"] },
    { on: ["postal_code"] },
    { on: ["status", "expires_at"] },
    { on: ["supplier_offer_id"] },
  ]);

export default ShippingQuote;
