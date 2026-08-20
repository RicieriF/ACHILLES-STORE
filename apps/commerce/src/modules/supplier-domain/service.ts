import { MedusaService } from "@medusajs/framework/utils";
import {
  AuditEvent,
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
  AuditEvent,
}) {}

export default SupplierDomainModuleService;
