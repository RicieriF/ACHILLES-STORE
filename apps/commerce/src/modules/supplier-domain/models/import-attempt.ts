import { model } from "@medusajs/framework/utils";

const ImportAttempt = model.define("import_attempt", {
  id: model.id({ prefix: "impattempt" }).primaryKey(),
  import_draft_id: model.text(),
  source_url: model.text(),
  canonical_url: model.text(),
  provider: model.text(),
  result: model.text(),
  method: model.text(),
  essential_data: model.json().nullable(),
  error_code: model.text().nullable(),
  error_message: model.text().nullable(),
  parser_version: model.text(),
  normalizer_version: model.text(),
});

export default ImportAttempt;
