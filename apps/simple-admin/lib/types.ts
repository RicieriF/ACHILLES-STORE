export type Product = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  sku: string | null;
  retailPrice: number | null;
  status: string;
  archived: boolean;
  operationalStatus: string;
  attention: string[];
  canPublish: boolean;
  publicationBlockers: string[];
  supplier: string | null;
  availability: string | null;
  landedCost: number | null;
  marginPercent: number | null;
};

export type Dashboard = {
  today: { sales: number; orders: number };
  catalog: { published: number; drafts: number };
  alerts: Array<{ productId: string; product: string; reason: string }>;
};

export type Order = {
  id: string;
  reference: string;
  status: string;
  total?: number;
  customer?: { name?: string; email?: string };
  items?: Array<{ title?: string }>;
};

export type SupplierIntegration = {
  id: string;
  name: string;
  status: string;
  detail: string;
  capabilities: Record<string, boolean>;
};
