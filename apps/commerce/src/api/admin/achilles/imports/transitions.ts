export type ImportStatus =
  "FETCHING" | "PARSED" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "FAILED";
export function assertDraftTransition(
  current: ImportStatus,
  target: "APPROVED" | "REJECTED",
  input: { complianceStatus: string; title?: string | null },
): void {
  if (current === "APPROVED" || current === "REJECTED")
    throw Object.assign(new Error("Draft já finalizado"), {
      code: "INVALID_TRANSITION",
    });
  if (target === "APPROVED" && input.complianceStatus === "BLOCKED")
    throw Object.assign(new Error("Item bloqueado não pode ser aprovado"), {
      code: "COMPLIANCE_BLOCKED",
    });
  if (target === "APPROVED" && !input.title?.trim())
    throw Object.assign(
      new Error("Título sugerido é obrigatório antes da aprovação"),
      { code: "INCOMPLETE_DATA" },
    );
}
