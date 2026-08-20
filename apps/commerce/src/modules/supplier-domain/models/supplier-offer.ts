import { model } from "@medusajs/framework/utils";
import BrandingProfile from "./branding-profile";
import Supplier from "./supplier";
import SupplierVariantMap from "./supplier-variant-map";

const SupplierOffer = model
  .define("supplier_offer", {
    id: model.id({ prefix: "supoff" }).primaryKey(),
    product_id: model.text(),
    supplier_product_id: model.text(),
    source_url: model.text(),
    currency: model.text(),
    unit_cost: model.text(),
    moq: model.number().default(1),
    availability: model
      .enum(["UNKNOWN", "IN_STOCK", "OUT_OF_STOCK"])
      .default("UNKNOWN"),
    availability_quantity: model.number().nullable(),
    private_label_supported: model.boolean().default(false),
    branding_moq: model.number().nullable(),
    is_primary: model.boolean().default(false),
    freight_metadata: model.json().nullable(),
    last_sync_at: model.dateTime().nullable(),
    sync_status: model
      .enum(["NEVER_SYNCED", "SYNCED", "STALE", "FAILED"])
      .default("NEVER_SYNCED"),
    raw_source_reference: model.text().nullable(),
    supplier: model.belongsTo(() => Supplier, { mappedBy: "offers" }),
    branding_profile: model
      .belongsTo(() => BrandingProfile, { mappedBy: "offers" })
      .nullable(),
    variant_maps: model.hasMany(() => SupplierVariantMap, {
      mappedBy: "supplier_offer",
    }),
  })
  .indexes([
    { on: ["product_id"] },
    {
      name: "IDX_supplier_offer_external_unique",
      on: ["supplier_id", "supplier_product_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_supplier_offer_primary_unique",
      on: ["product_id"],
      unique: true,
      where: "is_primary = true AND deleted_at IS NULL",
    },
  ]);

export default SupplierOffer;
