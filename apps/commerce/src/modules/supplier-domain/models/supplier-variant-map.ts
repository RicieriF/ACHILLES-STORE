import { model } from "@medusajs/framework/utils";
import SupplierOffer from "./supplier-offer";

const SupplierVariantMap = model
  .define("supplier_variant_map", {
    id: model.id({ prefix: "supvar" }).primaryKey(),
    store_variant_id: model.text(),
    supplier_sku: model.text(),
    supplier_variant_id: model.text().nullable(),
    attributes: model.json().nullable(),
    supplier_offer: model.belongsTo(() => SupplierOffer, {
      mappedBy: "variant_maps",
    }),
  })
  .indexes([
    { on: ["store_variant_id"] },
    {
      name: "IDX_supplier_variant_map_unique",
      on: ["supplier_offer_id", "store_variant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);

export default SupplierVariantMap;
