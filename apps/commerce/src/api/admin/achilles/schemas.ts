import { z } from "zod";

const nullableText = z.string().trim().max(4000).nullable().optional();
const safeMetadata = z
  .record(
    z.string().max(80),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  )
  .optional();
const decimal = z.string().regex(/^\d+(\.\d{1,4})?$/);

export const supplierInput = z.object({
  name: z.string().trim().min(2).max(160),
  provider: z.enum(["ALIBABA", "CJ", "OTHER", "MANUAL"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  country_code: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  contact_name: nullableText,
  contact_email: z.email().nullable().optional(),
  contact_phone: z.string().trim().max(40).nullable().optional(),
  notes: nullableText,
  metadata: safeMetadata,
});

const supplierOfferShape = {
  supplier_id: z.string().min(1),
  product_id: z.string().min(1),
  supplier_product_id: z.string().trim().min(1).max(200),
  source_url: z
    .url()
    .refine((url) => ["http:", "https:"].includes(new URL(url).protocol)),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  unit_cost: decimal,
  moq: z.number().int().positive(),
  availability: z.enum(["UNKNOWN", "IN_STOCK", "OUT_OF_STOCK"]),
  availability_quantity: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  fulfillment_mode: z.enum([
    "PRIVATE_LABEL_DROPSHIP",
    "GENERIC_DROPSHIP",
    "BRAZIL_STOCK",
  ]),
  private_label_supported: z.boolean(),
  branding_moq: z.number().int().positive().nullable().optional(),
  branding_lead_time_days: z.number().int().nonnegative().nullable().optional(),
  branding_profile_id: z.string().nullable().optional(),
  is_primary: z.boolean().default(false),
  freight_metadata: safeMetadata,
  notes: nullableText,
};

export const supplierOfferInput = z
  .object(supplierOfferShape)
  .superRefine((value, context) => {
    if (
      !value.private_label_supported &&
      (value.branding_moq || value.branding_profile_id)
    ) {
      context.addIssue({
        code: "custom",
        path: ["private_label_supported"],
        message: "Branding exige suporte a private label",
      });
    }
  });

export const supplierOfferPatchInput = z
  .object({
    ...supplierOfferShape,
    status: z.enum(["ACTIVE", "INACTIVE"]),
    is_primary: z.boolean(),
  })
  .partial()
  .superRefine((value, context) => {
    if (
      value.private_label_supported === false &&
      (value.branding_moq || value.branding_profile_id)
    ) {
      context.addIssue({
        code: "custom",
        path: ["private_label_supported"],
        message: "Branding exige suporte a private label",
      });
    }
  });

export const brandingProfileInput = z.object({
  supplier_id: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  brand_name: z.string().trim().min(2).max(160),
  logo_asset_reference: z.url().nullable().optional(),
  packaging_instructions: nullableText,
  insert_instructions: nullableText,
  language: z.string().trim().min(2).max(20).default("pt-BR"),
  customization_notes: nullableText,
  branding_moq: z.number().int().positive().nullable().optional(),
  setup_cost: decimal.nullable().optional(),
  per_unit_branding_cost: decimal.nullable().optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  lead_time_days: z.number().int().nonnegative().nullable().optional(),
});

export const productPolicyInput = z
  .object({
    fulfillment_mode: z.enum([
      "PRIVATE_LABEL_DROPSHIP",
      "GENERIC_DROPSHIP",
      "BRAZIL_STOCK",
    ]),
    compliance_status: z.enum([
      "PENDING",
      "CLEAR",
      "REVIEW_REQUIRED",
      "BLOCKED",
    ]),
    sensitivity: z.enum(["ORDINARY", "EDGED_TOOL", "CONTROLLED_ITEM"]),
    compliance_notes: nullableText,
  })
  .superRefine((value, context) => {
    const invalidEdge =
      value.sensitivity === "EDGED_TOOL" &&
      !["REVIEW_REQUIRED", "BLOCKED"].includes(value.compliance_status);
    const invalidControlled =
      value.sensitivity === "CONTROLLED_ITEM" &&
      value.compliance_status !== "BLOCKED";
    if (invalidEdge || invalidControlled) {
      context.addIssue({
        code: "custom",
        path: ["compliance_status"],
        message: "Status incompatível com a sensibilidade do item",
      });
    }
  });

export const paginationInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().max(160).optional(),
  status: z.string().trim().max(40).optional(),
  product_id: z.string().trim().max(200).optional(),
  supplier_id: z.string().trim().max(200).optional(),
});

const pricingDecimal = z
  .string()
  .regex(/^\d+(\.\d{1,8})?$/, "Use decimal positivo com ponto");
export const pricingAssumptionsInput = z.object({
  fxRate: pricingDecimal.refine(
    (value) => value !== "0",
    "FX deve ser maior que zero",
  ),
  fxSource: z.string().trim().min(2).max(120),
  fxTimestamp: z.iso.datetime(),
  internationalShipping: pricingDecimal,
  internationalShippingAllocationMethod: z.enum([
    "PER_UNIT",
    "BY_QUANTITY",
    "MANUAL",
  ]),
  shippingAllocationQuantity: z.number().int().positive(),
  customsTaxEstimate: pricingDecimal,
  customsStrategy: z.enum([
    "CUSTOMER_AS_IMPORTER",
    "MERCHANT_AS_IMPORTER",
    "MANUAL_QUOTE",
  ]),
  brandingUnitCost: pricingDecimal,
  brandingSetupCost: pricingDecimal,
  brandingSetupAllocationQuantity: z.number().int().positive(),
  paymentGatewayPercent: pricingDecimal,
  paymentGatewayFixed: pricingDecimal,
  paymentGatewayProvider: z.string().trim().min(2).max(120),
  localDeliveryCost: pricingDecimal,
  returnsRiskReservePercent: pricingDecimal,
  returnsRiskReserveFixed: pricingDecimal,
  operationalReservePercent: pricingDecimal,
  operationalReserveFixed: pricingDecimal,
  targetMarginPercent: pricingDecimal,
  promotionalBufferPercent: pricingDecimal,
  assumptions: z.array(z.string().trim().min(1).max(500)).max(30),
});

export type SupplierInput = z.infer<typeof supplierInput>;
export type SupplierOfferInput = z.infer<typeof supplierOfferInput>;
export type BrandingProfileInput = z.infer<typeof brandingProfileInput>;
export type ProductPolicyInput = z.infer<typeof productPolicyInput>;
export type PricingAssumptionsInput = z.infer<typeof pricingAssumptionsInput>;
