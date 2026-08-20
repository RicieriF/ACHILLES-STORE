import { describe, expect, it } from "vitest";
import { assertValidCpf, isValidCpf, maskCpf, normalizeCpf } from "./cpf";

describe("CPF", () => {
  it("normaliza, valida dígitos e mascara", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(maskCpf("52998224725")).toBe("***.***.***-25");
  });
  it.each(["", "111.111.111-11", "52998224724", "123"])(
    "rejeita %s",
    (value) => {
      expect(() => assertValidCpf(value)).toThrow("CPF_INVALID");
    },
  );
});
