import { describe, expect, it } from "vitest";
import type { ShippingQuoteRequest } from "@achilles/domain";
import {
  AlibabaShippingQuoteProvider,
  CJShippingQuoteProvider,
  ManualShippingQuoteProvider,
} from "./providers";

const request: ShippingQuoteRequest = {
  productId: "prod_1",
  variantId: "variant_1",
  providerProductId: "external_1",
  supplierOfferId: "offer_1",
  supplierSku: "sku_1",
  quantity: 1,
  originCountryCode: "CN",
  destination: { countryCode: "BR", postalCode: "01310100" },
};

describe("shipping providers", () => {
  it("retorna cotação manual somente com premissas explícitas", async () => {
    const provider = new ManualShippingQuoteProvider(
      [
        {
          serviceCode: "MANUAL_ECONOMY",
          methodName: "Entrega Econômica",
          currency: "BRL",
          amount: "79.90",
          estimatedMinimumDays: 12,
          estimatedMaximumDays: 18,
          trackingSupported: true,
          dutiesMode: "UNKNOWN",
          warnings: [],
          assumptions: ["Tabela manual aprovada"],
          ttlSeconds: 300,
        },
      ],
      () => new Date("2026-08-20T12:00:00.000Z"),
    );
    const [quote] = await provider.quote(request);
    expect(quote).toMatchObject({
      provider: "MANUAL",
      amount: "79.90",
      dutiesMode: "UNKNOWN",
      expiresAt: "2026-08-20T12:05:00.000Z",
    });
  });

  it("não inventa cotação manual sem configuração", async () => {
    await expect(
      new ManualShippingQuoteProvider([]).quote(request),
    ).rejects.toThrow("não configurada");
  });

  it("mantém Alibaba e CJ desativados por padrão", async () => {
    const alibaba = new AlibabaShippingQuoteProvider(false);
    const cj = new CJShippingQuoteProvider(false);
    expect(alibaba.getCapabilities().health).toBe("DISABLED");
    expect(cj.getCapabilities().health).toBe("DISABLED");
    await expect(alibaba.quote(request)).rejects.toThrow("desativada");
    await expect(cj.quote(request)).rejects.toThrow("desativada");
  });

  it.each(["DDP", "DAP", "UNKNOWN"] as const)(
    "preserva duties mode %s sem inferência",
    async (dutiesMode) => {
      const [quote] = await new ManualShippingQuoteProvider([
        {
          serviceCode: dutiesMode,
          methodName: dutiesMode,
          currency: "BRL",
          amount: "1.00",
          estimatedMinimumDays: 1,
          estimatedMaximumDays: 2,
          trackingSupported: false,
          dutiesMode,
          warnings: [],
          assumptions: ["Fixture"],
          ttlSeconds: 30,
        },
      ]).quote(request);
      expect(quote?.dutiesMode).toBe(dutiesMode);
    },
  );
});
