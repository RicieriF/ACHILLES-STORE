import type {
  ImportTaxContext,
  ImportTaxEstimate,
  ImportTaxStrategy,
  ImportTaxStrategyKind,
} from "@achilles/domain";

export class ConfiguredImportTaxStrategy implements ImportTaxStrategy {
  constructor(
    readonly kind: ImportTaxStrategyKind,
    private readonly estimatedAmountBrl: string,
    private readonly configuredAssumptions: readonly string[],
  ) {}

  // Estimativas são configuradas manualmente nesta tarefa; providers legais/fiscais são futuros.
  estimate(_context: ImportTaxContext): Promise<ImportTaxEstimate> {
    return Promise.resolve({
      strategy: this.kind,
      estimatedTax: { amount: this.estimatedAmountBrl, currency: "BRL" },
      assumptions: this.configuredAssumptions,
      warnings: [
        "Estimativa tributária manual/configurada; não é valor garantido",
      ],
      isGuaranteed: false,
    });
  }
}
