import { model } from "@medusajs/framework/utils";
import Supplier from "./supplier";
import SupplierOffer from "./supplier-offer";

const BrandingProfile = model.define("branding_profile", {
  id: model.id({ prefix: "brandprof" }).primaryKey(),
  name: model.text(),
  brand_name: model.text(),
  logo_asset_reference: model.text().nullable(),
  packaging_instructions: model.text().nullable(),
  insert_instructions: model.text().nullable(),
  language: model.text().default("pt-BR"),
  customization_notes: model.text().nullable(),
  branding_moq: model.number().nullable(),
  setup_cost: model.text().nullable(),
  per_unit_branding_cost: model.text().nullable(),
  currency: model.text().default("USD"),
  lead_time_days: model.number().nullable(),
  supplier: model.belongsTo(() => Supplier, { mappedBy: "branding_profiles" }),
  offers: model.hasMany(() => SupplierOffer, { mappedBy: "branding_profile" }),
});

export default BrandingProfile;
