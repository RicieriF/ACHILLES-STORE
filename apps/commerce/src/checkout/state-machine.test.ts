import { describe, expect, it } from "vitest";
import { assertCheckoutTransition, canTransition } from "./state-machine";

describe("máquina de estados do checkout", () => {
  it("percorre o fluxo nominal até READY_FOR_PAYMENT", () => {
    expect(canTransition("CART", "CUSTOMER")).toBe(true);
    expect(canTransition("CUSTOMER", "ADDRESS")).toBe(true);
    expect(canTransition("ADDRESS", "SHIPPING")).toBe(true);
    expect(canTransition("SHIPPING", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "READY_FOR_PAYMENT")).toBe(true);
  });

  it("permite expiração, recotação e bloqueio seguros", () => {
    expect(canTransition("REVIEW", "EXPIRED_SHIPPING")).toBe(true);
    expect(canTransition("READY_FOR_PAYMENT", "REQUOTE_REQUIRED")).toBe(true);
    expect(canTransition("SHIPPING", "BLOCKED")).toBe(true);
  });

  it("impede pular de carrinho direto para pagamento", () => {
    expect(() => {
      assertCheckoutTransition("CART", "READY_FOR_PAYMENT");
    }).toThrow();
  });
});
