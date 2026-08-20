import { MedusaService } from "@medusajs/framework/utils";
import {
  BrandingProfile,
  ProductPolicy,
  Supplier,
  SupplierOffer,
  SupplierVariantMap,
} from "./models";

class SupplierDomainModuleService extends MedusaService({
  Supplier,
  SupplierOffer,
  SupplierVariantMap,
  BrandingProfile,
  ProductPolicy,
}) {}

export default SupplierDomainModuleService;
