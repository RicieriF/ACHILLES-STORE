import { z } from "zod";

export const brazilCommerceDefaults = {
  countryCode: "br",
  currencyCode: "brl",
  businessLocale: "pt-BR",
  displayTimezone: "America/Sao_Paulo",
  regionName: "Brasil / BRL",
  salesChannelName: "Achilles Store Brasil",
} as const;

export const complianceStatuses = [
  "PENDING",
  "CLEAR",
  "REVIEW_REQUIRED",
  "BLOCKED",
] as const;

export type ComplianceStatus = (typeof complianceStatuses)[number];

export const productSensitivityKinds = [
  "ORDINARY",
  "EDGED_TOOL",
  "CONTROLLED_ITEM",
] as const;

export type ProductSensitivityKind = (typeof productSensitivityKinds)[number];

export function defaultComplianceStatus(
  sensitivity: ProductSensitivityKind,
): ComplianceStatus {
  if (sensitivity === "CONTROLLED_ITEM") {
    return "BLOCKED";
  }

  if (sensitivity === "EDGED_TOOL") {
    return "REVIEW_REQUIRED";
  }

  return "PENDING";
}

const monetaryAmountSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/, "Use a decimal string, never floating point");

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  provider: z.string().trim().min(2).max(80),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const brandingProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brandName: z.string().trim().min(1).max(160),
  logoAssetReference: z.string().trim().min(1).nullable().default(null),
  packagingInstructions: z.string().trim().max(4000).nullable().default(null),
  insertInstructions: z.string().trim().max(4000).nullable().default(null),
  language: z.string().trim().min(2).max(35).default("pt-BR"),
  customizationNotes: z.string().trim().max(4000).nullable().default(null),
  brandingMoq: z.number().int().positive().nullable().default(null),
  setupCost: monetaryAmountSchema.nullable().default(null),
  perUnitBrandingCost: monetaryAmountSchema.nullable().default(null),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  leadTimeDays: z.number().int().nonnegative().nullable().default(null),
});

export const supplierOfferSchema = z.object({
  id: z.string().trim().min(1),
  supplierId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  supplierProductId: z.string().trim().min(1).max(255),
  sourceUrl: z.url(),
  currency: z.string().trim().length(3).toUpperCase(),
  unitCost: monetaryAmountSchema,
  moq: z.number().int().positive(),
  isPrimary: z.boolean().default(false),
  privateLabelSupported: z.boolean().default(false),
});

export type SupplierOfferInput = z.input<typeof supplierOfferSchema>;

export function validateSupplierOffersForProduct(
  productId: string,
  offers: readonly SupplierOfferInput[],
) {
  const parsed = offers.map((offer) => supplierOfferSchema.parse(offer));
  if (parsed.some((offer) => offer.productId !== productId)) {
    throw new Error(
      "All supplier offers must belong to the same store product",
    );
  }

  if (parsed.filter((offer) => offer.isPrimary).length > 1) {
    throw new Error(
      "A store product can have at most one primary supplier offer",
    );
  }

  return parsed;
}
