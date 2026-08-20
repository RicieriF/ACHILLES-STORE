import { model } from "@medusajs/framework/utils";

const TaxpayerIdentity = model
  .define("taxpayer_identity", {
    id: model.id({ prefix: "taxid" }).primaryKey(),
    type: model.enum(["CPF", "CNPJ", "PASSPORT_FUTURE"]),
    normalized_value: model.text(),
    country: model.text().default("BR"),
    purpose: model.text(),
    verified_format: model.boolean().default(false),
  })
  .indexes([{ on: ["type", "normalized_value"] }]);

export default TaxpayerIdentity;
