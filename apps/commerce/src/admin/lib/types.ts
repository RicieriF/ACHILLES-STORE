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
  currency: string;
  unit_cost: string;
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
};

export const fulfillmentLabels: Record<string, string> = {
  PRIVATE_LABEL_DROPSHIP: "Dropshipping com Marca Própria",
  GENERIC_DROPSHIP: "Dropshipping Genérico",
  BRAZIL_STOCK: "Estoque Brasil",
};
