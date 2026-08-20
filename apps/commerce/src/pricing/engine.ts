import { DecimalValue as D } from "../lib/decimal";

export const PRICING_ENGINE_VERSION = "1.0.0";
export const taxStrategies = [
  "CUSTOMER_AS_IMPORTER",
  "MERCHANT_AS_IMPORTER",
  "MANUAL_QUOTE",
] as const;
export const shippingAllocationMethods = [
  "PER_UNIT",
  "BY_QUANTITY",
  "MANUAL",
] as const;

export interface FxRateProvider {
  readonly kind: "MANUAL" | "EXTERNAL";
  snapshot(): { rate: string; source: string; timestamp: string };
}

export class ManualFxRateProvider implements FxRateProvider {
  readonly kind = "MANUAL" as const;
  constructor(
    private readonly rate: string,
    private readonly source: string,
    private readonly timestamp: string,
  ) {}
  snapshot() {
    return { rate: this.rate, source: this.source, timestamp: this.timestamp };
  }
}

export type PricingInputs = {
  sourceCurrency: string;
  supplierUnitCost: string;
  moq: number;
  fxRate: string;
  fxSource: string;
  fxTimestamp: string;
  internationalShipping: string;
  internationalShippingAllocationMethod: (typeof shippingAllocationMethods)[number];
  shippingAllocationQuantity: number;
  customsTaxEstimate: string;
  customsStrategy: (typeof taxStrategies)[number];
  brandingUnitCost: string;
  brandingSetupCost: string;
  brandingSetupAllocationQuantity: number;
  paymentGatewayPercent: string;
  paymentGatewayFixed: string;
  paymentGatewayProvider: string;
  localDeliveryCost: string;
  returnsRiskReservePercent: string;
  returnsRiskReserveFixed: string;
  operationalReservePercent: string;
  operationalReserveFixed: string;
  targetMarginPercent: string;
  promotionalBufferPercent: string;
  assumptions: string[];
};

export type PricingOutputs = {
  supplierCostBrl: string;
  minimumMerchandiseCapitalBrl: string;
  internationalShippingBrl: string;
  customsTaxEstimateBrl: string;
  brandingCostBrl: string;
  paymentGatewayAtSuggestedBrl: string;
  reservesAtSuggestedBrl: string;
  landedCost: string;
  breakEvenPrice: string;
  suggestedRetailPrice: string;
  grossMarginPercent: string;
  contributionMargin: string;
  warnings: string[];
};

const hundred = D.parse("100");
const one = D.parse("1");

export function calculatePricing(input: PricingInputs): PricingOutputs {
  validate(input);
  const unitSource = D.parse(input.supplierUnitCost);
  const fx = D.parse(input.fxRate);
  const supplier = unitSource.multiply(fx);
  const moq = D.parse(String(input.moq));
  const shippingRaw = D.parse(input.internationalShipping);
  const shipping =
    input.internationalShippingAllocationMethod === "BY_QUANTITY"
      ? shippingRaw.divide(D.parse(String(input.shippingAllocationQuantity)))
      : shippingRaw;
  const tax = D.parse(input.customsTaxEstimate);
  const branding = D.parse(input.brandingUnitCost).add(
    D.parse(input.brandingSetupCost).divide(
      D.parse(String(input.brandingSetupAllocationQuantity)),
    ),
  );
  const localDelivery = D.parse(input.localDeliveryCost);
  const gatewayFixed = D.parse(input.paymentGatewayFixed);
  const fixedReserves = D.parse(input.returnsRiskReserveFixed).add(
    D.parse(input.operationalReserveFixed),
  );
  const landed = supplier
    .add(shipping)
    .add(tax)
    .add(branding)
    .add(localDelivery);
  const fixedBase = landed.add(gatewayFixed).add(fixedReserves);
  const gatewayRate = percent(input.paymentGatewayPercent);
  const reserveRate = percent(input.returnsRiskReservePercent).add(
    percent(input.operationalReservePercent),
  );
  const promotionalRate = percent(input.promotionalBufferPercent);
  const variableRate = gatewayRate.add(reserveRate).add(promotionalRate);
  const targetMargin = percent(input.targetMarginPercent);
  const breakEvenDenominator = one.subtract(variableRate);
  const retailDenominator = breakEvenDenominator.subtract(targetMargin);
  if (breakEvenDenominator.isNegative() || breakEvenDenominator.isZero())
    throw new Error("Taxas variáveis devem totalizar menos de 100%");
  if (retailDenominator.isNegative() || retailDenominator.isZero())
    throw new Error("Taxas e margem alvo devem totalizar menos de 100%");
  const breakEven = fixedBase.divide(breakEvenDenominator);
  const suggested = fixedBase.divide(retailDenominator);
  const gatewayAtSuggested = suggested.multiply(gatewayRate).add(gatewayFixed);
  const reservesAtSuggested = suggested
    .multiply(reserveRate)
    .add(fixedReserves);
  const contribution = suggested
    .subtract(landed)
    .subtract(gatewayAtSuggested)
    .subtract(reservesAtSuggested)
    .subtract(suggested.multiply(promotionalRate));
  const grossMargin = suggested
    .subtract(landed)
    .divide(suggested)
    .multiply(hundred);
  return {
    supplierCostBrl: supplier.toFixed(2),
    minimumMerchandiseCapitalBrl: supplier.multiply(moq).toFixed(2),
    internationalShippingBrl: shipping.toFixed(2),
    customsTaxEstimateBrl: tax.toFixed(2),
    brandingCostBrl: branding.toFixed(2),
    paymentGatewayAtSuggestedBrl: gatewayAtSuggested.toFixed(2),
    reservesAtSuggestedBrl: reservesAtSuggested.toFixed(2),
    landedCost: landed.toFixed(2),
    breakEvenPrice: breakEven.toFixed(2),
    suggestedRetailPrice: suggested.toFixed(2),
    grossMarginPercent: grossMargin.toFixed(4),
    contributionMargin: contribution.toFixed(2),
    warnings: [
      "Estimativa comercial; tributos, frete e câmbio não são garantidos",
      "Preço sugerido exige aprovação humana e não implica publicação",
    ],
  };
}

function percent(value: string): D {
  return D.parse(value).divide(hundred);
}

function validate(input: PricingInputs): void {
  if (!Number.isInteger(input.moq) || input.moq <= 0)
    throw new Error("MOQ deve ser positivo");
  if (
    !Number.isInteger(input.shippingAllocationQuantity) ||
    input.shippingAllocationQuantity <= 0
  )
    throw new Error("Quantidade de rateio do frete deve ser positiva");
  if (
    !Number.isInteger(input.brandingSetupAllocationQuantity) ||
    input.brandingSetupAllocationQuantity <= 0
  )
    throw new Error("Quantidade de rateio de branding deve ser positiva");
  for (const [name, value] of Object.entries(input).filter(
    ([, value]) => typeof value === "string",
  )) {
    if (!isDecimalField(name)) continue;
    const decimal = D.parse(value as string);
    if (decimal.isNegative()) throw new Error(`${name} não pode ser negativo`);
  }
  if (D.parse(input.fxRate).isZero())
    throw new Error("FX deve ser maior que zero");
  if (!input.fxSource.trim() || !input.fxTimestamp)
    throw new Error("Fonte e timestamp de FX são obrigatórios");
  if (!taxStrategies.includes(input.customsStrategy))
    throw new Error("Estratégia tributária inválida");
}

function isDecimalField(name: string): boolean {
  return new Set([
    "supplierUnitCost",
    "fxRate",
    "internationalShipping",
    "customsTaxEstimate",
    "brandingUnitCost",
    "brandingSetupCost",
    "paymentGatewayPercent",
    "paymentGatewayFixed",
    "localDeliveryCost",
    "returnsRiskReservePercent",
    "returnsRiskReserveFixed",
    "operationalReservePercent",
    "operationalReserveFixed",
    "targetMarginPercent",
    "promotionalBufferPercent",
  ]).has(name);
}
