import { describe, expect, it } from "vitest";
import { ShippingPolicy, type ShippingPolicyStrategy } from "./policy";

const policy = new ShippingPolicy();
const apply = (
  strategy: ShippingPolicyStrategy,
  configuration: Partial<{
    fixedCustomerPrice: string;
    subsidy: string;
    threshold: string;
  }> = {},
  subtotal = "200.00",
) =>
  policy.apply({
    providerCostBrl: "50.00",
    cartSubtotalBrl: subtotal,
    configuration: {
      strategy,
      assumptions: ["Regra de teste"],
      ...configuration,
    },
  });

describe("ShippingPolicy", () => {
  it("repassa custo do provider", () => {
    expect(apply("PASS_THROUGH")).toMatchObject({
      customerShippingPrice: "50.00",
      subsidy: "0.00",
    });
  });

  it("aplica preço fixo", () => {
    expect(
      apply("FIXED_CUSTOMER_PRICE", { fixedCustomerPrice: "29.90" }),
    ).toMatchObject({ customerShippingPrice: "29.90", subsidy: "20.10" });
  });

  it("registra subsídio sem apagar o custo real", () => {
    expect(apply("SUBSIDIZED", { subsidy: "15.00" })).toMatchObject({
      providerCost: "50.00",
      customerShippingPrice: "35.00",
      subsidy: "15.00",
    });
  });

  it("aplica grátis acima do threshold e preserva custo/subsídio", () => {
    expect(apply("FREE_OVER_THRESHOLD", { threshold: "150.00" })).toMatchObject(
      {
        providerCost: "50.00",
        customerShippingPrice: "0.00",
        subsidy: "50.00",
        threshold: "150.00",
      },
    );
    expect(apply("FREE_OVER_THRESHOLD", { threshold: "250.00" })).toMatchObject(
      { customerShippingPrice: "50.00", subsidy: "0.00" },
    );
  });

  it("suporta frete incluído e manual", () => {
    expect(apply("INCLUDED_IN_PRODUCT").customerShippingPrice).toBe("0.00");
    expect(
      apply("MANUAL", { fixedCustomerPrice: "20.00" }).customerShippingPrice,
    ).toBe("20.00");
  });
});
