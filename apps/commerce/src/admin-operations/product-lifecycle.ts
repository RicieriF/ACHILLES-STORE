export type ProductDeletionFacts = {
  status: string;
  offers: number;
  orderLines: number;
  cartLines: number;
  shippingQuotes: number;
  routingDecisions: number;
};

export function productDeletionDecision(facts: ProductDeletionFacts): {
  allowed: boolean;
  reasons: string[];
  archiveRecommended: boolean;
} {
  const reasons: string[] = [];
  if (facts.status !== "draft")
    reasons.push("Produto publicado deve ser retirado de venda e arquivado.");
  if (facts.orderLines > 0) reasons.push("Produto possui histórico de pedido.");
  if (facts.cartLines > 0)
    reasons.push("Produto está vinculado a carrinho ou checkout.");
  if (facts.offers > 0) reasons.push("Produto possui fornecedor vinculado.");
  if (facts.shippingQuotes > 0 || facts.routingDecisions > 0)
    reasons.push("Produto possui histórico operacional de frete.");
  return {
    allowed: reasons.length === 0,
    reasons,
    archiveRecommended: reasons.length > 0,
  };
}
