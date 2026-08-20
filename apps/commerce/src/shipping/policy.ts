import { DecimalValue } from "../lib/decimal";

export type ShippingPolicyStrategy =
  | "PASS_THROUGH"
  | "FIXED_CUSTOMER_PRICE"
  | "SUBSIDIZED"
  | "FREE_OVER_THRESHOLD"
  | "INCLUDED_IN_PRODUCT"
  | "MANUAL";

export type ShippingPolicyConfiguration = {
  strategy: ShippingPolicyStrategy;
  fixedCustomerPrice?: string | undefined;
  subsidy?: string | undefined;
  threshold?: string | undefined;
  assumptions: readonly string[];
};

export type ShippingPolicyResult = {
  providerCost: string;
  customerShippingPrice: string;
  subsidy: string;
  rule: ShippingPolicyStrategy;
  threshold: string | null;
  currency: "BRL";
  assumptions: readonly string[];
};

export class ShippingPolicy {
  apply(input: {
    providerCostBrl: string;
    cartSubtotalBrl: string;
    configuration: ShippingPolicyConfiguration;
  }): ShippingPolicyResult {
    const provider = DecimalValue.parse(input.providerCostBrl);
    const subtotal = DecimalValue.parse(input.cartSubtotalBrl);
    const configuration = input.configuration;
    let customer = provider;

    if (["FIXED_CUSTOMER_PRICE", "MANUAL"].includes(configuration.strategy))
      customer = DecimalValue.parse(required(configuration.fixedCustomerPrice));
    if (configuration.strategy === "SUBSIDIZED") {
      const requested = DecimalValue.parse(configuration.subsidy ?? "0");
      customer = provider.subtract(
        provider.isGreaterThanOrEqual(requested) ? requested : provider,
      );
    }
    if (configuration.strategy === "FREE_OVER_THRESHOLD") {
      const threshold = DecimalValue.parse(required(configuration.threshold));
      customer = subtotal.isGreaterThanOrEqual(threshold)
        ? DecimalValue.zero()
        : provider;
    }
    if (configuration.strategy === "INCLUDED_IN_PRODUCT")
      customer = DecimalValue.zero();

    return {
      providerCost: provider.toFixed(2),
      customerShippingPrice: customer.toFixed(2),
      subsidy: provider.subtract(customer).toFixed(2),
      rule: configuration.strategy,
      threshold: configuration.threshold ?? null,
      currency: "BRL",
      assumptions: configuration.assumptions,
    };
  }
}

function required(value: string | undefined): string {
  if (!value) throw new Error("Configuração obrigatória de frete ausente");
  return value;
}
