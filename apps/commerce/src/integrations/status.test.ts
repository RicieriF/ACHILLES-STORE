import { afterEach, describe, expect, it } from "vitest";
import { integrationCards, sanitizedOperationalConfig } from "./status";
import {
  clearRuntimeProviderHealth,
  setRuntimeProviderHealth,
} from "./runtime-health";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  clearRuntimeProviderHealth();
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
  it("persists only a real validated CJ connection in server runtime", () => {
    process.env.CJ_ENABLED = "true";
    process.env.CJ_PRODUCT_IMPORT = "true";
    process.env.CJ_API_KEY = "configured";
    process.env.CJ_BASE_URL = "https://developers.cjdropshipping.com";
    setRuntimeProviderHealth("CJ", {
      connected: true,
      checkedAt: new Date().toISOString(),
      health: "HEALTHY",
      capabilities: { productImport: true },
      errorCode: null,
      testMode: false,
    });
    expect(integrationCards().find((item) => item.id === "cj")).toMatchObject({
      status: "CONNECTED",
      capabilities: {
        productImport: true,
        orderCreate: false,
        orderPay: false,
      },
    });
  });
  it("uses permission required before Alibaba authorization", () => {
    process.env.ALIBABA_ENABLED = "true";
    process.env.ALIBABA_APP_KEY = "configured";
    process.env.ALIBABA_APP_SECRET = "configured";
    delete process.env.ALIBABA_ACCESS_TOKEN;
    expect(
      integrationCards().find((item) => item.id === "alibaba")?.status,
    ).toBe("PERMISSION_REQUIRED");
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
  it("marks the E2E fixture as configured but never connected", () => {
    process.env.APP_ENV = "test";
    process.env.CJ_ENABLED = "true";
    process.env.CJ_TEST_MODE = "true";
    process.env.CJ_API_KEY = "fixture-only";
    process.env.CJ_BASE_URL = "https://fixture.invalid";
    const card = integrationCards().find((item) => item.id === "cj");
    expect(card).toMatchObject({
      status: "CONFIGURED",
      configured: { testMode: true },
      capabilities: { orderCreate: false, orderPay: false },
    });
    expect(card?.status).not.toBe("CONNECTED");
  });
});
