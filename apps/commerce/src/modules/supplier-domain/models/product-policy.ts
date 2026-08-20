import { model } from "@medusajs/framework/utils";

const ProductPolicy = model
  .define("product_policy", {
    id: model.id({ prefix: "prodpol" }).primaryKey(),
    product_id: model.text(),
    fulfillment_mode: model
      .enum(["PRIVATE_LABEL_DROPSHIP", "GENERIC_DROPSHIP", "BRAZIL_STOCK"])
      .default("PRIVATE_LABEL_DROPSHIP"),
    compliance_status: model
      .enum(["PENDING", "CLEAR", "REVIEW_REQUIRED", "BLOCKED"])
      .default("PENDING"),
    sensitivity: model
      .enum(["ORDINARY", "EDGED_TOOL", "CONTROLLED_ITEM"])
      .default("ORDINARY"),
    compliance_notes: model.text().nullable(),
    reviewed_by: model.text().nullable(),
    reviewed_at: model.dateTime().nullable(),
    commercial_readiness: model
      .enum([
        "DATA_INCOMPLETE",
        "PRICING_REQUIRED",
        "COMPLIANCE_REQUIRED",
        "READY_FOR_REVIEW",
        "BLOCKED",
      ])
      .default("DATA_INCOMPLETE"),
    import_draft_id: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_product_policy_product_unique",
      on: ["product_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["compliance_status"] },
    { on: ["commercial_readiness"] },
  ]);

export default ProductPolicy;
