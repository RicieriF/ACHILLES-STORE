import { describe, expect, it } from "vitest";
import { DecimalValue } from "../lib/decimal";
import {
  calculatePricing,
  ManualFxRateProvider,
  type PricingInputs,
} from "./engine";

const input = (overrides: Partial<PricingInputs> = {}): PricingInputs => ({
  sourceCurrency: "USD",
  supplierUnitCost: "8.40",
  moq: 10,
  fxRate: "5.42",
  fxSource: "Manual Admin",
  fxTimestamp: "2026-08-20T12:00:00.000Z",
  internationalShipping: "28.00",
  internationalShippingAllocationMethod: "PER_UNIT",
  shippingAllocationQuantity: 1,
  customsTaxEstimate: "42.50",
  customsStrategy: "MANUAL_QUOTE",
  brandingUnitCost: "3.00",
  brandingSetupCost: "20.00",
  brandingSetupAllocationQuantity: 10,
  paymentGatewayPercent: "5.00",
  paymentGatewayFixed: "1.00",
  paymentGatewayProvider: "Premissa manual",
  localDeliveryCost: "12.00",
  returnsRiskReservePercent: "2.00",
  returnsRiskReserveFixed: "1.00",
  operationalReservePercent: "3.00",
  operationalReserveFixed: "2.00",
  targetMarginPercent: "30.00",
  promotionalBufferPercent: "5.00",
  assumptions: ["Tributação é estimativa manual"],
  ...overrides,
});

describe("Pricing Engine decimal", () => {
  it("converte USD para BRL e calcula capital mínimo por MOQ", () => {
    const result = calculatePricing(input());
    expect(result.supplierCostBrl).toBe("45.53");
    expect(result.minimumMerchandiseCapitalBrl).toBe("455.28");
  });

  it("mantém precisão decimal sem floating point", () => {
    expect(
      DecimalValue.parse("0.1").add(DecimalValue.parse("0.2")).toFixed(2),
    ).toBe("0.30");
    expect(
      DecimalValue.parse("8.40")
        .multiply(DecimalValue.parse("5.42"))
        .toFixed(2),
    ).toBe("45.53");
  });

  it("rateia frete total pela quantidade", () => {
    const result = calculatePricing(
      input({
        internationalShipping: "280.00",
        internationalShippingAllocationMethod: "BY_QUANTITY",
        shippingAllocationQuantity: 10,
      }),
    );
    expect(result.internationalShippingBrl).toBe("28.00");
  });

  it("mantém frete por unidade e manual", () => {
    expect(calculatePricing(input()).internationalShippingBrl).toBe("28.00");
    expect(
      calculatePricing(
        input({ internationalShippingAllocationMethod: "MANUAL" }),
      ).internationalShippingBrl,
    ).toBe("28.00");
  });

  it("inclui tributação manual e branding rateado", () => {
    const result = calculatePricing(input());
    expect(result.customsTaxEstimateBrl).toBe("42.50");
    expect(result.brandingCostBrl).toBe("5.00");
  });

  it("inclui gateway percentual e fixo separadamente", () => {
    const withoutGateway = calculatePricing(
      input({ paymentGatewayPercent: "0", paymentGatewayFixed: "0" }),
    );
    const withGateway = calculatePricing(input());
    expect(
      DecimalValue.parse(withGateway.breakEvenPrice).isGreaterThanOrEqual(
        DecimalValue.parse(withoutGateway.breakEvenPrice),
      ),
    ).toBe(true);
    expect(withGateway.paymentGatewayAtSuggestedBrl).not.toBe("0.00");
  });

  it("inclui reservas percentuais e fixas", () => {
    const result = calculatePricing(input());
    expect(result.reservesAtSuggestedBrl).not.toBe("0.00");
  });

  it("calcula landed cost, break-even e preço sugerido rastreáveis", () => {
    const result = calculatePricing(input());
    expect(result.landedCost).toBe("133.03");
    expect(
      DecimalValue.parse(result.suggestedRetailPrice).isGreaterThanOrEqual(
        DecimalValue.parse(result.breakEvenPrice),
      ),
    ).toBe(true);
    expect(result.contributionMargin).not.toBe("0.00");
  });

  it("calcula margem, não markup", () => {
    const result = calculatePricing(
      input({
        supplierUnitCost: "50",
        fxRate: "1",
        internationalShipping: "0",
        customsTaxEstimate: "0",
        brandingUnitCost: "0",
        brandingSetupCost: "0",
        paymentGatewayPercent: "0",
        paymentGatewayFixed: "0",
        localDeliveryCost: "0",
        returnsRiskReservePercent: "0",
        returnsRiskReserveFixed: "0",
        operationalReservePercent: "0",
        operationalReserveFixed: "0",
        promotionalBufferPercent: "0",
        targetMarginPercent: "50",
      }),
    );
    expect(result.suggestedRetailPrice).toBe("100.00");
    expect(result.grossMarginPercent).toBe("50.0000");
  });

  it("congela snapshot de FX manual", () => {
    const provider = new ManualFxRateProvider(
      "5.42",
      "Banco manual",
      "2026-08-20T12:00:00.000Z",
    );
    expect(provider.snapshot()).toEqual({
      rate: "5.42",
      source: "Banco manual",
      timestamp: "2026-08-20T12:00:00.000Z",
    });
  });

  it.each([
    ["custo negativo", { supplierUnitCost: "-1" }],
    ["FX zero", { fxRate: "0" }],
    ["MOQ zero", { moq: 0 }],
    [
      "margem impossível",
      { targetMarginPercent: "99", paymentGatewayPercent: "2" },
    ],
  ])("rejeita %s", (_label, overrides) => {
    expect(() =>
      calculatePricing(input(overrides as Partial<PricingInputs>)),
    ).toThrow();
  });
});
