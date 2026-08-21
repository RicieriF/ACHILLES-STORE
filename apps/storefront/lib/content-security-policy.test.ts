import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  isLocalDevelopment,
} from "./content-security-policy";

describe("storefront Content-Security-Policy", () => {
  it.each(["development", "local"])(
    "allows unsafe-eval only for APP_ENV=%s",
    (APP_ENV) => {
      expect(contentSecurityPolicy({ APP_ENV })).toContain("'unsafe-eval'");
    },
  );

  it.each(["production", "staging", "test", "preview"])(
    "keeps APP_ENV=%s strict",
    (APP_ENV) => {
      expect(contentSecurityPolicy({ APP_ENV })).not.toContain("'unsafe-eval'");
    },
  );

  it("fails closed for unknown or conflicting environments", () => {
    expect(isLocalDevelopment({})).toBe(false);
    expect(
      contentSecurityPolicy({ APP_ENV: "staging", NODE_ENV: "development" }),
    ).not.toContain("'unsafe-eval'");
    expect(
      contentSecurityPolicy({ APP_ENV: "development", NODE_ENV: "production" }),
    ).not.toContain("'unsafe-eval'");
  });

  it("uses NODE_ENV development only when APP_ENV is absent", () => {
    expect(contentSecurityPolicy({ NODE_ENV: "development" })).toContain(
      "'unsafe-eval'",
    );
    expect(contentSecurityPolicy({ NODE_ENV: "production" })).not.toContain(
      "'unsafe-eval'",
    );
  });
});
