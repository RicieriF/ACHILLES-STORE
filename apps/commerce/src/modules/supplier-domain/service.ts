import { MedusaService } from "@medusajs/framework/utils";
import {
  AuditEvent,
  BrandingProfile,
  ProductPolicy,
  Supplier,
  SupplierOffer,
  SupplierVariantMap,
  ImportDraft,
  ImportAttempt,
} from "./models";

class SupplierDomainModuleService extends MedusaService({
  Supplier,
  SupplierOffer,
  SupplierVariantMap,
  BrandingProfile,
  ProductPolicy,
  AuditEvent,
  ImportDraft,
  ImportAttempt,
}) {}

export default SupplierDomainModuleService;
