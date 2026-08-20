import { afterEach, describe, expect, it } from "vitest";
import { integrationCards, sanitizedOperationalConfig } from "./status";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("integration status", () => {
  it("does not mistake placeholders for a connected provider", () => {
    process.env.ALIBABA_PRODUCT_IMPORT = "true";
    process.env.ALIBABA_APP_KEY = "";
    expect(
      integrationCards().find((item) => item.id === "alibaba")?.status,
    ).toBe("NOT_CONFIGURED");
    expect(integrationCards().some((item) => item.status === "CONNECTED")).toBe(
      false,
    );
  });
  it("never returns secret values", () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "secret-value-must-not-leak";
    expect(JSON.stringify(sanitizedOperationalConfig())).not.toContain(
      "secret-value-must-not-leak",
    );
    expect(sanitizedOperationalConfig().secrets.mercadoPagoAccessToken).toBe(
      "Configurado ✓",
    );
  });
});
