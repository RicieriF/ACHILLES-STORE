import { describe, expect, it } from "vitest";
import {
  findWorkspaceRoot,
  parseFeatureFlags,
  parseServerEnvironment,
} from "./index.js";

describe("workspace environment", () => {
  it("locates one monorepo root from package directories", () => {
    expect(findWorkspaceRoot(process.cwd())).toBeTruthy();
    expect(findWorkspaceRoot(process.cwd())).not.toMatch(/apps[\\/]commerce$/);
  });
});

describe("feature flags", () => {
  it("defaults every supplier and payment capability to disabled", () => {
    expect(parseFeatureFlags({})).toEqual({
      ALIBABA_PRODUCT_IMPORT: false,
      ALIBABA_FREIGHT_QUOTE: false,
      ALIBABA_ORDER_CREATE: false,
      ALIBABA_ORDER_PAY: false,
      ALIBABA_TRACKING: false,
      CJ_PRODUCT_LOOKUP: false,
      CJ_SHIPPING_QUOTE: false,
      CJ_ORDER_CREATE: false,
      CJ_ORDER_PAY: false,
      CJ_TRACKING: false,
      MERCADO_PAGO_ENABLED: false,
      MERCADO_PAGO_PIX: false,
      MERCADO_PAGO_CARD: false,
      MERCADO_PAGO_BOLETO: false,
    });
  });
  it("rejects ambiguous boolean values", () => {
    expect(() => parseFeatureFlags({ ALIBABA_ORDER_PAY: "yes" })).toThrow();
  });
});

describe("server environment", () => {
  const validEnvironment = {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://achilles:test@localhost:5432/achilles_store",
    STORE_CORS: "http://localhost:3000",
    ADMIN_CORS: "http://localhost:9000",
    AUTH_CORS: "http://localhost:3000,http://localhost:9000",
    JWT_SECRET: "test_placeholder_minimum_24_chars",
    COOKIE_SECRET: "test_placeholder_minimum_24_chars",
  } as const;

  it("defaults business localization to pt-BR and São Paulo", () => {
    expect(parseServerEnvironment(validEnvironment)).toMatchObject({
      BUSINESS_LOCALE: "pt-BR",
      DISPLAY_TIMEZONE: "America/Sao_Paulo",
    });
  });

  it("rejects invalid database protocols and timezones", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: "sqlite://local.db",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DISPLAY_TIMEZONE: "Brazil/Not-A-Zone",
      }),
    ).toThrow();
  });
});
