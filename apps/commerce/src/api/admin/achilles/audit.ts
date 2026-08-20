type SafeSnapshot = Record<string, unknown> | null;
type AuditWriter = {
  createAuditEvents(input: {
    action: string;
    entity_type: string;
    entity_id: string;
    actor_id: string | null;
    summary: string;
    before: SafeSnapshot;
    after: SafeSnapshot;
    metadata: SafeSnapshot;
  }): Promise<unknown>;
};

export async function recordAudit(
  service: AuditWriter,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    summary: string;
    before?: SafeSnapshot;
    after?: SafeSnapshot;
    metadata?: SafeSnapshot;
  },
): Promise<void> {
  await service.createAuditEvents({
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    actor_id: input.actorId,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
  });
}

export function safeSnapshot(value: object): SafeSnapshot {
  return JSON.parse(JSON.stringify(value)) as SafeSnapshot;
}
