import type { FeatureFlags } from "@achilles/config";
import type {
  Availability,
  BrandingOptions,
  Money,
  ShippingQuote,
  SupplierCapabilities,
  SupplierConnector,
  SupplierOrder,
  SupplierOrderDraft,
  SupplierProductRef,
  SupplierVariant,
  Tracking,
} from "@achilles/domain";

export class AlibabaCapabilityDisabledError extends Error {
  constructor(capability: keyof SupplierCapabilities) {
    super(`Alibaba capability is disabled or not configured: ${capability}`);
    this.name = "AlibabaCapabilityDisabledError";
  }
}

export class AlibabaConnector implements SupplierConnector {
  readonly provider = "ALIBABA";
  readonly capabilities: SupplierCapabilities;
  constructor(flags: FeatureFlags) {
    this.capabilities = {
      productImport: flags.ALIBABA_PRODUCT_IMPORT,
      freightQuote: flags.ALIBABA_FREIGHT_QUOTE,
      orderCreate: flags.ALIBABA_ORDER_CREATE,
      orderPay: flags.ALIBABA_ORDER_PAY,
      tracking: flags.ALIBABA_TRACKING,
      privateLabel: false,
    };
  }
  getProduct(_reference: SupplierProductRef): Promise<SupplierProductRef> {
    return this.unavailable("productImport");
  }
  getVariants(
    _reference: SupplierProductRef,
  ): Promise<readonly SupplierVariant[]> {
    return this.unavailable("productImport");
  }
  getPrice(
    _reference: SupplierProductRef,
    _supplierSku: string,
  ): Promise<Money> {
    return this.unavailable("productImport");
  }
  getAvailability(
    _reference: SupplierProductRef,
    _supplierSku: string,
  ): Promise<Availability> {
    return this.unavailable("productImport");
  }
  getShippingQuote(
    _reference: SupplierProductRef,
    _supplierSku: string,
    _destinationCountry: string,
  ): Promise<ShippingQuote> {
    return this.unavailable("freightQuote");
  }
  createOrder(_draft: SupplierOrderDraft): Promise<SupplierOrder> {
    return this.unavailable("orderCreate");
  }
  getOrder(_supplierOrderId: string): Promise<SupplierOrder> {
    return this.unavailable("orderCreate");
  }
  getTracking(_supplierOrderId: string): Promise<Tracking> {
    return this.unavailable("tracking");
  }
  supportsPrivateLabel(_reference: SupplierProductRef): Promise<boolean> {
    return this.unavailable("privateLabel");
  }
  getBrandingOptions(_reference: SupplierProductRef): Promise<BrandingOptions> {
    return this.unavailable("privateLabel");
  }
  private unavailable<T>(capability: keyof SupplierCapabilities): Promise<T> {
    return Promise.reject(new AlibabaCapabilityDisabledError(capability));
  }
}
