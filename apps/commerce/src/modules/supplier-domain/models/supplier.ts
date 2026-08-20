import { model } from "@medusajs/framework/utils";
import BrandingProfile from "./branding-profile";
import SupplierOffer from "./supplier-offer";

const Supplier = model
  .define("supplier", {
    id: model.id({ prefix: "sup" }).primaryKey(),
    name: model.text().searchable(),
    provider: model.text(),
    status: model.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    metadata: model.json().nullable(),
    offers: model.hasMany(() => SupplierOffer, { mappedBy: "supplier" }),
    branding_profiles: model.hasMany(() => BrandingProfile, {
      mappedBy: "supplier",
    }),
  })
  .indexes([
    { on: ["provider"] },
    {
      name: "IDX_supplier_provider_name_unique",
      on: ["provider", "name"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);

export default Supplier;
