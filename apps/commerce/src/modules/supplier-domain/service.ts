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
  CostQuote,
  PricingSnapshot,
  ShippingQuote,
  SupplierRoutingDecision,
  CheckoutSession,
  CheckoutShippingSelection,
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
  CostQuote,
  PricingSnapshot,
  ShippingQuote,
  SupplierRoutingDecision,
  CheckoutSession,
  CheckoutShippingSelection,
}) {}

export default SupplierDomainModuleService;
