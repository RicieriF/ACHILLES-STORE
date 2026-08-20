import { model } from "@medusajs/framework/utils";

const ImportDraft = model
  .define("import_draft", {
    id: model.id({ prefix: "impdraft" }).primaryKey(),
    provider: model.text(),
    source_url: model.text(),
    canonical_source_url: model.text(),
    supplier_product_id: model.text().nullable(),
    status: model
      .enum([
        "FETCHING",
        "PARSED",
        "NEEDS_REVIEW",
        "APPROVED",
        "REJECTED",
        "FAILED",
      ])
      .default("NEEDS_REVIEW"),
    title_raw: model.text().nullable(),
    title_normalized: model.text().nullable(),
    description_raw: model.text().nullable(),
    description_normalized: model.text().nullable(),
    source_currency: model.text().nullable(),
    source_price_min: model.text().nullable(),
    source_price_max: model.text().nullable(),
    moq: model.number().nullable(),
    category_raw: model.text().nullable(),
    category_suggested: model.text().nullable(),
    media: model.json().default({ items: [] }),
    specifications: model.json().default({}),
    variants: model.json().default({ items: [] }),
    supplier_snapshot: model.json().nullable(),
    raw_provider_metadata: model.json().nullable(),
    compliance_status: model
      .enum(["CLEAR", "REVIEW_REQUIRED", "BLOCKED"])
      .default("CLEAR"),
    alerts: model.json().default({ items: [] }),
    failure_reason: model.text().nullable(),
    created_by: model.text().nullable(),
    last_fetch_at: model.dateTime().nullable(),
    converted_product_id: model.text().nullable(),
    conversion_status: model
      .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"])
      .default("NOT_STARTED"),
    conversion_started_at: model.dateTime().nullable(),
    conversion_completed_at: model.dateTime().nullable(),
    conversion_failure_reason: model.text().nullable(),
  })
  .indexes([
    { on: ["canonical_source_url"] },
    { on: ["provider", "supplier_product_id"] },
    { on: ["status"] },
    {
      name: "IDX_import_draft_converted_product_unique",
      on: ["converted_product_id"],
      unique: true,
      where: "converted_product_id IS NOT NULL AND deleted_at IS NULL",
    },
  ]);

export default ImportDraft;
