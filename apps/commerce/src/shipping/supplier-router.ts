import type {
  ShippingRoutingCandidate,
  SupplierRoutingResult,
} from "@achilles/domain";

export type SupplierRoutingWeights = {
  deliveredCost: number;
  eta: number;
  primaryBonus: number;
  privateLabelBonus: number;
  privateLabelMismatchPenalty: number;
  warningPenalty: number;
  competitiveBrazilBonus: number;
};

const defaultWeights: SupplierRoutingWeights = {
  deliveredCost: 1,
  eta: 0.25,
  primaryBonus: 8,
  privateLabelBonus: 15,
  privateLabelMismatchPenalty: 100,
  warningPenalty: 4,
  competitiveBrazilBonus: 12,
};

export class SupplierRouter {
  constructor(private readonly weights = defaultWeights) {}

  route(
    candidates: readonly ShippingRoutingCandidate[],
    input: {
      privateLabelRequired: boolean;
      preferBrazilStockWhenCompetitive?: boolean;
    },
  ): SupplierRoutingResult {
    const eligible = candidates.filter((candidate) => candidate.available);
    const scores: Record<string, number> = {};
    const cheapest = Math.min(
      ...eligible.map((candidate) =>
        Number(candidate.deliveredSupplierCostBrl),
      ),
    );
    for (const candidate of eligible) {
      const cost = Number(candidate.deliveredSupplierCostBrl);
      const averageEta =
        (candidate.estimatedMinimumDays + candidate.estimatedMaximumDays) / 2;
      scores[candidate.quoteId] =
        -(cost * this.weights.deliveredCost) -
        averageEta * this.weights.eta +
        (candidate.isPrimary ? this.weights.primaryBonus : 0) +
        (candidate.privateLabelSupported
          ? this.weights.privateLabelBonus
          : input.privateLabelRequired
            ? -this.weights.privateLabelMismatchPenalty
            : 0) -
        candidate.warnings.length * this.weights.warningPenalty;
      const brazilCompetitive =
        input.preferBrazilStockWhenCompetitive === true &&
        candidate.fulfillmentMode === "BRAZIL_STOCK" &&
        cost <= cheapest * 1.1 &&
        averageEta <= 10 &&
        (candidate.marginPercent === undefined ||
          candidate.marginPercent >= 10) &&
        (candidate.reliabilityScore === undefined ||
          candidate.reliabilityScore >= 0.7);
      if (brazilCompetitive)
        scores[candidate.quoteId] =
          (scores[candidate.quoteId] ?? 0) +
          this.weights.competitiveBrazilBonus;
    }
    const ranked = [...eligible].sort(
      (left, right) =>
        (scores[right.quoteId] ?? Number.NEGATIVE_INFINITY) -
        (scores[left.quoteId] ?? Number.NEGATIVE_INFINITY),
    );
    const recommended = ranked[0] ?? null;
    return {
      recommended,
      alternatives: ranked.slice(1),
      reason: recommended
        ? routingReason(recommended, input.privateLabelRequired)
        : "Nenhuma oferta possui disponibilidade e cotação válida",
      scores,
    };
  }
}

function routingReason(
  candidate: ShippingRoutingCandidate,
  privateLabelRequired: boolean,
): string {
  const reasons = ["melhor pontuação transparente de custo entregue e prazo"];
  if (candidate.isPrimary) reasons.push("fornecedor principal");
  if (privateLabelRequired && candidate.privateLabelSupported)
    reasons.push("compatível com private label");
  return reasons.join("; ");
}
