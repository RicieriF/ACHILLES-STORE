import { describe, expect, it, vi } from "vitest";
import { recordAudit, safeSnapshot } from "./audit";

describe("admin audit events", () => {
  it("records action, entity, actor and safe before/after snapshots", async () => {
    const createAuditEvents = vi.fn().mockResolvedValue({ id: "audit_1" });
    await recordAudit(
      { createAuditEvents },
      {
        action: "SUPPLIER_UPDATED",
        entityType: "supplier",
        entityId: "sup_1",
        actorId: "user_1",
        summary: "Fornecedor atualizado",
        before: safeSnapshot({ status: "ACTIVE" }),
        after: safeSnapshot({ status: "INACTIVE" }),
      },
    );

    expect(createAuditEvents).toHaveBeenCalledWith({
      action: "SUPPLIER_UPDATED",
      entity_type: "supplier",
      entity_id: "sup_1",
      actor_id: "user_1",
      summary: "Fornecedor atualizado",
      before: { status: "ACTIVE" },
      after: { status: "INACTIVE" },
      metadata: null,
    });
  });
});
