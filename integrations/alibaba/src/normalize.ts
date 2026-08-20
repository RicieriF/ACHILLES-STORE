import type {
  NormalizedSupplierProduct,
  SupplierProductSource,
  SupplierVariant,
} from "@achilles/domain";

export const NORMALIZER_VERSION = "alibaba-deterministic/1.0.0";
const blocked =
  /\b(ammunition|firearm|gun\s*part|muni[cç][aã]o|arma\s+de\s+fogo|pe[cç]a\s+de\s+arma|controlled hunting item)\b/i;
const edged = /\b(faca|knife|canivete|blade|machete|l[aâ]mina)\b/i;
const clean = (value?: string) =>
  value?.replace(/\s+/g, " ").trim() || undefined;
export function decimal(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/[^\d.,-]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  return Number(normalized).toFixed(2);
}
export function normalizeProduct(
  source: SupplierProductSource,
): NormalizedSupplierProduct {
  const evidence = [
    source.title,
    source.description,
    ...Object.entries(source.specifications).flat(),
  ].join(" ");
  const compliance = blocked.test(evidence)
    ? "BLOCKED"
    : edged.test(evidence)
      ? "REVIEW_REQUIRED"
      : "CLEAR";
  const specifications = Object.fromEntries(
    Object.entries(source.specifications).map(([key, value]) => [
      clean(key) ?? key,
      clean(value) ?? value,
    ]),
  );
  const variants: SupplierVariant[] = source.variants.map((variant) => ({
    ...variant,
    title: clean(variant.title) ?? variant.title,
    attributes: Object.fromEntries(
      Object.entries(variant.attributes).map(([key, value]) => [
        clean(key) ?? key,
        clean(value) ?? value,
      ]),
    ),
  }));
  const alerts: string[] = [];
  if (!source.title)
    alerts.push("Título ausente; preenchimento manual necessário.");
  if (!source.currency || !source.priceMin)
    alerts.push("Preço/moeda incompletos; não inventados.");
  if (compliance === "REVIEW_REQUIRED")
    alerts.push(
      "Possível lâmina/ferramenta cortante: revisão de compliance obrigatória.",
    );
  if (compliance === "BLOCKED")
    alerts.push(
      "Possível item controlado: draft bloqueado por compliance preliminar.",
    );
  return {
    source,
    title: clean(source.title),
    description: clean(source.description),
    currency: source.currency?.trim().toUpperCase(),
    priceMin: decimal(source.priceMin),
    priceMax: decimal(source.priceMax),
    moq: source.moq && source.moq > 0 ? Math.trunc(source.moq) : undefined,
    categorySuggested: clean(source.category),
    specifications,
    variants,
    compliance,
    alerts,
    normalizerVersion: NORMALIZER_VERSION,
  };
}
