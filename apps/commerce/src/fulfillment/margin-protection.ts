export type MarginAssessment = {
  status: "PASS" | "REVIEW_REQUIRED" | "BLOCKED";
  revenue: string;
  knownCosts: string;
  margin: string | null;
  marginPercent: string | null;
  reasons: readonly string[];
};

export class SupplierMarginProtection {
  assess(input: {
    revenue: string;
    productCost: string | null;
    shippingCost: string | null;
    paymentFees: string | null;
    reserves: string | null;
    minimumMarginPercent: number;
  }): MarginAssessment {
    const unknown = [
      input.productCost,
      input.shippingCost,
      input.paymentFees,
      input.reserves,
    ].some((value) => value === null);
    const revenue = Number(input.revenue);
    const knownCosts = [
      input.productCost,
      input.shippingCost,
      input.paymentFees,
      input.reserves,
    ].reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
    if (unknown)
      return {
        status: "REVIEW_REQUIRED",
        revenue: fixed(revenue),
        knownCosts: fixed(knownCosts),
        margin: null,
        marginPercent: null,
        reasons: ["UNKNOWN_COSTS"],
      };
    const margin = revenue - knownCosts;
    const percent = revenue > 0 ? (margin / revenue) * 100 : -100;
    return {
      status: percent < input.minimumMarginPercent ? "BLOCKED" : "PASS",
      revenue: fixed(revenue),
      knownCosts: fixed(knownCosts),
      margin: fixed(margin),
      marginPercent: fixed(percent),
      reasons: percent < input.minimumMarginPercent ? ["MARGIN_TOO_LOW"] : [],
    };
  }
}

function fixed(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}
