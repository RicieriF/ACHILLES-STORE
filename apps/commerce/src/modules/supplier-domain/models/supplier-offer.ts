import { model } from "@medusajs/framework/utils";
import BrandingProfile from "./branding-profile";
import Supplier from "./supplier";
import SupplierVariantMap from "./supplier-variant-map";
import CostQuote from "./cost-quote";
import ShippingQuote from "./shipping-quote";

const SupplierOffer = model
  .define("supplier_offer", {
    id: model.id({ prefix: "supoff" }).primaryKey(),
    product_id: model.text(),
    supplier_product_id: model.text(),
    source_url: model.text(),
    canonical_source_url: model.text().nullable(),
    import_draft_id: model.text().nullable(),
    currency: model.text(),
    unit_cost: model.text(),
    unit_cost_max: model.text().nullable(),
    moq: model.number().default(1),
    availability: model
      .enum(["UNKNOWN", "IN_STOCK", "OUT_OF_STOCK"])
      .default("UNKNOWN"),
    availability_quantity: model.number().nullable(),
    status: model.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    fulfillment_mode: model
      .enum(["PRIVATE_LABEL_DROPSHIP", "GENERIC_DROPSHIP", "BRAZIL_STOCK"])
      .default("PRIVATE_LABEL_DROPSHIP"),
    private_label_supported: model.boolean().default(false),
    branding_moq: model.number().nullable(),
    branding_lead_time_days: model.number().nullable(),
    notes: model.text().nullable(),
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
    cost_quotes: model.hasMany(() => CostQuote, { mappedBy: "supplier_offer" }),
    shipping_quotes: model.hasMany(() => ShippingQuote, {
      mappedBy: "supplier_offer",
    }),
  })
  .indexes([
    { on: ["product_id"] },
    { on: ["status"] },
    {
      name: "IDX_supplier_offer_import_draft_unique",
      on: ["import_draft_id"],
      unique: true,
      where: "import_draft_id IS NOT NULL AND deleted_at IS NULL",
    },
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
