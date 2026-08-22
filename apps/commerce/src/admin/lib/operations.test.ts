import { describe, expect, it } from "vitest";
import { adminErrorMessage, humanStatus, statusBadgeColor } from "./operations";

describe("Admin operational labels", () => {
  it.each([
    ["COMPLIANCE_HOLD", "Pendente de revisão"],
    ["DATA_INCOMPLETE", "Cadastro incompleto"],
    ["CLEAR", "Aprovado"],
    ["REVIEW_REQUIRED", "Revisão necessária"],
    ["BLOCKED", "Bloqueado"],
    ["draft", "Rascunho"],
    ["published", "Publicado"],
    ["PAID", "Pago"],
    ["SHIPPED", "Enviado"],
    ["APPROVAL_REQUIRED", "Aguardando fornecedor"],
    ["BLOCKING", "Bloqueia venda"],
  ])("translates %s for operators", (status, label) => {
    expect(humanStatus(status)).toBe(label);
  });

  it("uses warning rather than critical color for compliance review", () => {
    expect(statusBadgeColor("COMPLIANCE_HOLD")).toBe("orange");
    expect(statusBadgeColor("REVIEW_REQUIRED")).toBe("orange");
    expect(statusBadgeColor("BLOCKED")).toBe("red");
  });

  it("returns a human fallback without exposing unknown values", () => {
    expect(adminErrorMessage(null)).toBe(
      "Não foi possível atualizar o rascunho. Tente novamente.",
    );
  });
});
