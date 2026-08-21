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
