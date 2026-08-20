import { describe, expect, it } from "vitest";
import { sanitizeRecipientForSandbox } from "./service";

describe("PII boundary", () => {
  it("não envia endereço, telefone, CPF, pagamento ou margem reais ao sandbox", () => {
    const recipient = sanitizeRecipientForSandbox({
      street: "Avenida Paulista",
      number: "1000",
      complement: "Apto 42",
      city: "São Paulo",
      state: "SP",
      postalCode: "01310100",
      countryCode: "BR",
    });
    const serialized = JSON.stringify(recipient);
    expect(recipient).toMatchObject({
      name: "CLIENTE TESTE",
      phone: "TEST-NOT-SENT",
      postalCode: "*****100",
    });
    expect(serialized).not.toMatch(/Paulista|1000|Apto|CPF|token|margin/i);
  });
});
