import type { OperationalProductCandidate } from "./types";

export const publicationMessages: Readonly<Record<string, string>> = {
  PRODUCT_NOT_PUBLISHED: "O produto ainda é um rascunho",
  PUBLIC_SALES_CHANNEL_MISSING:
    "O produto ainda não está pronto para a vitrine",
  PRODUCT_BLOCKED: "Produto bloqueado",
  PRESENTATION_DATA_MISSING: "Complete o título do produto",
  DESCRIPTION_MISSING: "Complete a descrição",
  VARIANT_MISSING: "O produto precisa de uma variação",
  CATEGORY_MISSING: "Escolha uma categoria",
  POLICY_MISSING: "Aguarde a revisão",
  COMPLIANCE_NOT_CLEAR: "Aguarde a revisão",
  COMMERCIAL_READINESS_NOT_ALLOWED: "Complete o cadastro",
  PRIMARY_OFFER_NOT_ACTIVE: "Vincule um fornecedor",
  APPROVED_PRICE_MISSING: "Defina o preço",
  PRICE_STALE: "Atualize o preço",
  PRICE_NOT_CURRENT: "Defina o preço",
  PRICE_NOT_APPROVED: "Defina o preço",
  COMMERCIAL_PRICE_INVALID: "Defina o preço",
  CORE_PRICE_NOT_APPROVED: "Defina o preço",
  PRODUCT_NOT_FOUND: "Produto não encontrado",
  PUBLICATION_GATE_UNAVAILABLE: "Não foi possível verificar a publicação",
};

export function humanPublicationReasons(reasons: readonly string[]): string[] {
  return [
    ...new Set(
      reasons.map(
        (reason) =>
          publicationMessages[reason] ?? "Complete os dados do produto",
      ),
    ),
  ];
}

export function operatorPublicationBlockers(
  product: Pick<
    OperationalProductCandidate,
    | "retailPrice"
    | "offerId"
    | "offerStatus"
    | "compliance"
    | "pricingStatus"
    | "category"
  > & { archived?: boolean },
): string[] {
  const blockers: string[] = [];
  if (product.archived) blockers.push("Produto arquivado");
  if (
    product.retailPrice === null ||
    product.retailPrice <= 0 ||
    product.pricingStatus !== "PRICED"
  )
    blockers.push("Defina o preço");
  if (!product.offerId || product.offerStatus === "INACTIVE")
    blockers.push("Vincule um fornecedor");
  if (product.compliance === "BLOCKED") blockers.push("Produto bloqueado");
  else if (product.compliance !== "CLEAR") blockers.push("Aguarde a revisão");
  if (!product.category) blockers.push("Escolha uma categoria");
  return [...new Set(blockers)];
}

export function canPublishProduct(
  product: OperationalProductCandidate & { archived?: boolean },
): boolean {
  return (
    product.status !== "published" &&
    !product.archived &&
    operatorPublicationBlockers(product).length === 0
  );
}
