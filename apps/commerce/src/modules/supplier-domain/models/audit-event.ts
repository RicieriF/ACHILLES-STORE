import { model } from "@medusajs/framework/utils";

const AuditEvent = model
  .define("audit_event", {
    id: model.id({ prefix: "audit" }).primaryKey(),
    action: model.text(),
    entity_type: model.text(),
    entity_id: model.text(),
    actor_id: model.text().nullable(),
    summary: model.text(),
    before: model.json().nullable(),
    after: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["entity_type", "entity_id"] },
    { on: ["action"] },
    { on: ["created_at"] },
  ]);

export default AuditEvent;
