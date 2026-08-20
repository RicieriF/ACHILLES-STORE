import type { Money } from "./supplier.js";

export const importTaxStrategyKinds = [
  "CUSTOMER_AS_IMPORTER",
  "MERCHANT_AS_IMPORTER",
  "MANUAL_QUOTE",
] as const;
export type ImportTaxStrategyKind = (typeof importTaxStrategyKinds)[number];
export interface ImportTaxContext {
  productValue: Money;
  freight: Money;
  destinationCountry: "BR";
  calculatedAt: string;
}
export interface ImportTaxEstimate {
  strategy: ImportTaxStrategyKind;
  estimatedTax: Money | null;
  assumptions: readonly string[];
  warnings: readonly string[];
  isGuaranteed: false;
}
export interface ImportTaxStrategy {
  readonly kind: ImportTaxStrategyKind;
  estimate(context: ImportTaxContext): Promise<ImportTaxEstimate>;
}
