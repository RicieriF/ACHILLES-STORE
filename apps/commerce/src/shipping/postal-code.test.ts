import { describe, expect, it } from "vitest";
import { normalizeBrazilPostalCode } from "./postal-code";

describe("CEP brasileiro", () => {
  it.each(["01310-100", "01310100"])("normaliza %s", (postalCode) => {
    expect(normalizeBrazilPostalCode(postalCode)).toBe("01310100");
  });

  it.each(["01310", "01310-10A", "abcdefgh", "01310 100", "123456789"])(
    "rejeita formato inválido %s",
    (postalCode) => {
      expect(() => normalizeBrazilPostalCode(postalCode)).toThrow();
    },
  );
});
