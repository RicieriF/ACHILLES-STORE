import { z } from "zod";

const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Use decimal positivo com ponto");
export const createImportInput = z
  .object({ source_url: z.url().max(2048) })
  .strict();
export const updateImportInput = z
  .object({
    title_normalized: z.string().trim().min(1).max(500).optional(),
    description_normalized: z.string().trim().max(20_000).nullable().optional(),
    source_currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),
    source_price_min: decimal.nullable().optional(),
    source_price_max: decimal.nullable().optional(),
    moq: z.number().int().positive().max(1_000_000).nullable().optional(),
    category_suggested: z.string().trim().max(200).nullable().optional(),
    media: z.array(z.url().max(2048)).max(20).optional(),
    specifications: z
      .record(z.string().max(200), z.string().max(2_000))
      .optional(),
    variants: z
      .array(
        z.object({
          supplierSku: z.string().max(200),
          title: z.string().max(500),
          attributes: z.record(z.string(), z.string()),
        }),
      )
      .max(200)
      .optional(),
  })
  .strict();
export const rejectImportInput = z
  .object({ reason: z.string().trim().min(3).max(2_000) })
  .strict();
export const importListInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z
    .enum([
      "FETCHING",
      "PARSED",
      "NEEDS_REVIEW",
      "APPROVED",
      "REJECTED",
      "FAILED",
    ])
    .optional(),
});
