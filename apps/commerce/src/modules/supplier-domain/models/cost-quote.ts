import { model } from "@medusajs/framework/utils";
import SupplierOffer from "./supplier-offer";

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
    customs_tax: model.text().nullable(),
    branding_cost: model.text().nullable(),
    payment_fee: model.text().nullable(),
    local_delivery: model.text().nullable(),
    risk_reserve: model.text().nullable(),
    target_margin: model.text().nullable(),
    assumptions: model.json().default({ items: [] }),
    supplier_offer: model.belongsTo(() => SupplierOffer, {
      mappedBy: "cost_quotes",
    }),
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
