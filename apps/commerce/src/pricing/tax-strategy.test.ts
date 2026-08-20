import { describe, expect, it } from "vitest";
import { ConfiguredImportTaxStrategy } from "./tax-strategy";

describe("ImportTaxStrategy configurada", () => {
  it.each([
    "CUSTOMER_AS_IMPORTER",
    "MERCHANT_AS_IMPORTER",
    "MANUAL_QUOTE",
  ] as const)(
    "preserva estratégia %s e nunca garante o tributo",
    async (kind) => {
      const strategy = new ConfiguredImportTaxStrategy(kind, "42.50", [
        "Cotação manual",
      ]);
      const result = await strategy.estimate({
        productValue: { amount: "45.53", currency: "BRL" },
        freight: { amount: "28.00", currency: "BRL" },
        destinationCountry: "BR",
        calculatedAt: "2026-08-20T12:00:00.000Z",
      });
      expect(result.strategy).toBe(kind);
      expect(result.estimatedTax?.amount).toBe("42.50");
      expect(result.isGuaranteed).toBe(false);
    },
  );
});
