import { describe, expect, it } from "vitest";
import { parseFeatureFlags, parseServerEnvironment } from "./index.js";

describe("feature flags", () => {
  it("defaults every Alibaba capability to disabled", () => {
    expect(parseFeatureFlags({})).toEqual({
      ALIBABA_PRODUCT_IMPORT: false,
      ALIBABA_FREIGHT_QUOTE: false,
      ALIBABA_ORDER_CREATE: false,
      ALIBABA_ORDER_PAY: false,
      ALIBABA_TRACKING: false,
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
