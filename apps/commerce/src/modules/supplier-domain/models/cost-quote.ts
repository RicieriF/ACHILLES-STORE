import { model } from "@medusajs/framework/utils";
import SupplierOffer from "./supplier-offer";
import PricingSnapshot from "./pricing-snapshot";

const CostQuote = model
  .define("cost_quote", {
    id: model.id({ prefix: "costq" }).primaryKey(),
    status: model
      .enum(["INCOMPLETE", "READY_FOR_PRICING", "PRICED", "STALE"])
      .default("INCOMPLETE"),
    source_currency: model.text(),
    supplier_unit_cost: model.text(),
    supplier_unit_cost_max: model.text().nullable(),
    moq: model.number(),
    fx_rate: model.text().nullable(),
    fx_source: model.text().nullable(),
    fx_captured_at: model.dateTime().nullable(),
    international_freight: model.text().nullable(),
    international_shipping_allocation_method: model
      .enum(["PER_UNIT", "BY_QUANTITY", "MANUAL"])
      .nullable(),
    shipping_allocation_quantity: model.number().nullable(),
    customs_tax: model.text().nullable(),
    customs_strategy: model
      .enum(["CUSTOMER_AS_IMPORTER", "MERCHANT_AS_IMPORTER", "MANUAL_QUOTE"])
      .nullable(),
    branding_cost: model.text().nullable(),
    branding_setup_cost: model.text().nullable(),
    branding_setup_allocation: model.number().nullable(),
    payment_fee: model.text().nullable(),
    payment_gateway_percent: model.text().nullable(),
    payment_gateway_provider: model.text().nullable(),
    local_delivery: model.text().nullable(),
    risk_reserve: model.text().nullable(),
    returns_risk_reserve_percent: model.text().nullable(),
    operational_reserve: model.text().nullable(),
    operational_reserve_percent: model.text().nullable(),
    target_margin: model.text().nullable(),
    promotional_buffer: model.text().nullable(),
    landed_cost: model.text().nullable(),
    break_even_price: model.text().nullable(),
    suggested_retail_price: model.text().nullable(),
    gross_margin_percent: model.text().nullable(),
    contribution_margin: model.text().nullable(),
    assumptions: model.json().default({ items: [] }),
    warnings: model.json().default({ items: [] }),
    calculated_at: model.dateTime().nullable(),
    approved_at: model.dateTime().nullable(),
    approved_by: model.text().nullable(),
    approved_retail_price: model.text().nullable(),
    approved_snapshot_id: model.text().nullable(),
    supplier_offer: model.belongsTo(() => SupplierOffer, {
      mappedBy: "cost_quotes",
    }),
    snapshots: model.hasMany(() => PricingSnapshot, { mappedBy: "cost_quote" }),
  })
  .indexes([
    {
      name: "IDX_cost_quote_offer_unique",
      on: ["supplier_offer_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["status"] },
  ]);

export default CostQuote;
