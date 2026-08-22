export type AttentionReason =
  | "SEM_IMAGEM"
  | "SEM_PRECO"
  | "SEM_FORNECEDOR"
  | "SEM_ESTOQUE"
  | "COMPLIANCE_REVIEW"
  | "PRICE_STALE"
  | "SHIPPING_STALE"
  | "BLOCKED"
  | "SUPPLIER_UNAVAILABLE";

export type OperationalProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  sku: string | null;
  category: string | null;
  categoryId: string | null;
  retailPrice: number | null;
  compareAtPrice: number | null;
  landedCost: number | null;
  marginPercent: number | null;
  stock: number | null;
  manageInventory: boolean;
  supplier: string | null;
  supplierId: string | null;
  supplierStatus?: string | null;
  offerStatus?: string | null;
  provider: string | null;
  origin: string | null;
  offerId: string | null;
  offerCount: number;
  availability: string | null;
  supplierAvailabilityQuantity: number | null;
  supplierLeadTimeDays: number | null;
  fulfillmentMode: string | null;
  compliance: string;
  commercialReadiness: string;
  pricingStatus: string | null;
  syncStatus: string | null;
  lastSyncAt: string | null;
  updatedAt: string;
  featured: boolean;
  attention: AttentionReason[];
  operationalStatus: string;
  archived?: boolean;
  canPublish?: boolean;
  publicationBlockers?: string[];
};

export type DashboardData = {
  today: {
    sales: number;
    orders: number;
    averageTicket: number;
    estimatedProfit: number | null;
    pendingPayments: number;
    awaitingSupplier: number;
    exceptions: number;
  };
  catalog: {
    total: number;
    published: number;
    drafts: number;
    withoutPrice: number;
    withoutStock: number;
    withoutSupplier: number;
    compliancePending: number;
    blocked: number;
  };
  providers: Array<{
    provider: string;
    status: string;
    health: string;
    suppliers: number;
    offers: number;
    products: number;
    problems: number;
  }>;
  alerts: Array<{
    productId: string;
    product: string;
    reason: AttentionReason;
    severity: string;
  }>;
  empty: boolean;
};

export const attentionLabels: Record<AttentionReason, string> = {
  SEM_IMAGEM: "Sem imagem",
  SEM_PRECO: "Sem preço",
  SEM_FORNECEDOR: "Sem fornecedor",
  SEM_ESTOQUE: "Sem estoque",
  COMPLIANCE_REVIEW: "Revisão de compliance",
  PRICE_STALE: "Preço desatualizado",
  SHIPPING_STALE: "Frete desatualizado",
  BLOCKED: "Bloqueado",
  SUPPLIER_UNAVAILABLE: "Fornecedor indisponível",
};

export const money = (value: number | null) =>
  value === null
    ? "Não calculado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);

export type StatusBadgeColor = "green" | "orange" | "red" | "grey";

const statusLabels: Record<string, string> = {
  COMPLIANCE_HOLD: "Pendente de revisão",
  DATA_INCOMPLETE: "Cadastro incompleto",
  CLEAR: "Aprovado",
  REVIEW_REQUIRED: "Revisão necessária",
  BLOCKED: "Bloqueado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  PENDING: "Compliance pendente",
  READY: "Pronto",
  READY_FOR_REVIEW: "Pronto para revisão",
  NEEDS_ATTENTION: "Requer atenção",
  OUT_OF_STOCK: "Indisponível",
  PRICE_CHANGED: "Preço alterado",
  SHIPPING_CHANGED: "Frete alterado",
  SUPPLIER_UNAVAILABLE: "Fornecedor indisponível",
  IN_STOCK: "Disponível",
  UNKNOWN: "Não informado",
  PAID: "Pago",
  APPROVAL_REQUIRED: "Aguardando fornecedor",
  APPROVED: "Pedido ao fornecedor",
  SUPPLIER_APPROVAL_REQUIRED: "Aguardando fornecedor",
  FULFILLMENT_REVIEW: "Aguardando fornecedor",
  SUPPLIER_APPROVED: "Pedido ao fornecedor",
  SUPPLIER_CONFIRMED: "Pedido ao fornecedor",
  SHIPPED: "Enviado",
  IN_TRANSIT: "Enviado",
  DELIVERED: "Entregue",
  BLOCKING: "Bloqueia venda",
  ACTION_REQUIRED: "Completar cadastro",
};

export const humanStatus = (status: string | null | undefined) => {
  if (!status) return "Não informado";
  return statusLabels[status.toUpperCase()] ?? status.replaceAll("_", " ");
};

export const statusBadgeColor = (
  status: string | null | undefined,
): StatusBadgeColor => {
  const normalized = status?.toUpperCase();
  if (
    normalized &&
    ["CLEAR", "PUBLISHED", "READY", "IN_STOCK"].includes(normalized)
  )
    return "green";
  if (
    normalized &&
    ["BLOCKED", "OUT_OF_STOCK", "SUPPLIER_UNAVAILABLE", "FAILED"].includes(
      normalized,
    )
  )
    return "red";
  if (
    normalized &&
    [
      "COMPLIANCE_HOLD",
      "DATA_INCOMPLETE",
      "PENDING",
      "REVIEW_REQUIRED",
      "NEEDS_ATTENTION",
      "READY_FOR_REVIEW",
      "PRICE_CHANGED",
      "SHIPPING_CHANGED",
    ].includes(normalized)
  )
    return "orange";
  return "grey";
};

export const adminErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Não foi possível atualizar o rascunho. Tente novamente.";
