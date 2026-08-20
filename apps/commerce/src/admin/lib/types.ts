export type Supplier = {
  id: string;
  name: string;
  provider: "ALIBABA" | "OTHER" | "MANUAL";
  status: "ACTIVE" | "INACTIVE";
  country_code: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
  created_at: string;
  updated_at: string;
};

export type SupplierOffer = {
  id: string;
  product_id: string;
  supplier_product_id: string;
  source_url: string;
  canonical_source_url?: string | null;
  import_draft_id?: string | null;
  currency: string;
  unit_cost: string;
  unit_cost_max?: string | null;
  moq: number;
  availability: "UNKNOWN" | "IN_STOCK" | "OUT_OF_STOCK";
  branding_moq?: number | null;
  branding_lead_time_days?: number | null;
  notes?: string | null;
  status: "ACTIVE" | "INACTIVE";
  fulfillment_mode: string;
  private_label_supported: boolean;
  is_primary: boolean;
  last_sync_at?: string | null;
  supplier?: Supplier;
  cost_quotes?: CostQuote[];
};
export type CostQuote = {
  id: string;
  status: "INCOMPLETE" | "READY_FOR_PRICING" | "PRICED" | "STALE";
  source_currency: string;
  supplier_unit_cost: string;
  supplier_unit_cost_max?: string | null;
  moq: number;
};

export type BrandingProfile = {
  id: string;
  name: string;
  brand_name: string;
  language: string;
  logo_asset_reference?: string | null;
  packaging_instructions?: string | null;
  insert_instructions?: string | null;
  customization_notes?: string | null;
  currency: string;
  branding_moq?: number | null;
  setup_cost?: string | null;
  per_unit_branding_cost?: string | null;
  lead_time_days?: number | null;
  supplier?: Supplier;
};

export type ProductPolicy = {
  id: string;
  product_id: string;
  fulfillment_mode: string;
  compliance_status: "PENDING" | "CLEAR" | "REVIEW_REQUIRED" | "BLOCKED";
  sensitivity: "ORDINARY" | "EDGED_TOOL" | "CONTROLLED_ITEM";
  compliance_notes?: string | null;
  updated_at: string;
  commercial_readiness:
    | "DATA_INCOMPLETE"
    | "PRICING_REQUIRED"
    | "COMPLIANCE_REQUIRED"
    | "READY_FOR_REVIEW"
    | "BLOCKED";
  import_draft_id?: string | null;
};

export const fulfillmentLabels: Record<string, string> = {
  PRIVATE_LABEL_DROPSHIP: "Dropshipping com Marca Própria",
  GENERIC_DROPSHIP: "Dropshipping Genérico",
  BRAZIL_STOCK: "Estoque Brasil",
};
export type ImportDraft = {
  id: string;
  provider: string;
  source_url: string;
  canonical_source_url: string;
  supplier_product_id?: string | null;
  status:
    "FETCHING" | "PARSED" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "FAILED";
  title_raw?: string | null;
  title_normalized?: string | null;
  description_raw?: string | null;
  description_normalized?: string | null;
  source_currency?: string | null;
  source_price_min?: string | null;
  source_price_max?: string | null;
  moq?: number | null;
  category_raw?: string | null;
  category_suggested?: string | null;
  media: { items: string[] };
  specifications: Record<string, string>;
  variants: {
    items: Array<{
      supplierSku: string;
      title: string;
      attributes: Record<string, string>;
    }>;
  };
  compliance_status: "CLEAR" | "REVIEW_REQUIRED" | "BLOCKED";
  alerts: { items: string[] };
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
  last_fetch_at?: string | null;
  converted_product_id?: string | null;
  conversion_status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  conversion_failure_reason?: string | null;
};
