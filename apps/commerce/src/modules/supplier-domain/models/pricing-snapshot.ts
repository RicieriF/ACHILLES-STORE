import { model } from "@medusajs/framework/utils";
import CostQuote from "./cost-quote";

const PricingSnapshot = model
  .define("pricing_snapshot", {
    id: model.id({ prefix: "pricesnap" }).primaryKey(),
    version: model.number(),
    engine_version: model.text(),
    inputs: model.json(),
    outputs: model.json(),
    assumptions: model.json().default({ items: [] }),
    warnings: model.json().default({ items: [] }),
    fx_rate: model.text(),
    fx_source: model.text(),
    fx_timestamp: model.dateTime(),
    customs_strategy: model.text(),
    calculated_by: model.text().nullable(),
    calculated_at: model.dateTime(),
    approved_by: model.text().nullable(),
    approved_at: model.dateTime().nullable(),
    approved_retail_price: model.text().nullable(),
    cost_quote: model.belongsTo(() => CostQuote, { mappedBy: "snapshots" }),
  })
  .indexes([
    {
      name: "IDX_pricing_snapshot_quote_version",
      on: ["cost_quote_id", "version"],
      unique: true,
    },
    { on: ["cost_quote_id"] },
  ]);

export default PricingSnapshot;
