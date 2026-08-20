import { parseFeatureFlags } from "@achilles/config";

export type IntegrationStatus =
  | "CONNECTED"
  | "CONFIGURED"
  | "DISABLED"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED";

export type IntegrationCard = {
  id: string;
  name: string;
  section: "Fornecedores" | "Pagamentos" | "Logística" | "Comunicação";
  status: IntegrationStatus;
  health:
    "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "DISABLED" | "NOT_CONFIGURED";
  detail: string;
  configured: Record<string, boolean>;
  capabilities: Record<string, boolean>;
};

const configured = (name: string): boolean =>
  Boolean(process.env[name]?.trim());

export function maskConfigured(
  name: string,
): "Configurado ✓" | "Não configurado" {
  return configured(name) ? "Configurado ✓" : "Não configurado";
}

export function integrationCards(): IntegrationCard[] {
  const flags = parseFeatureFlags(process.env);
  const alibabaCredentials =
    configured("ALIBABA_APP_KEY") && configured("ALIBABA_APP_SECRET");
  const cjCredentials =
    configured("CJ_API_KEY") &&
    configured("CJ_ACCESS_TOKEN") &&
    configured("CJ_BASE_URL");
  const mpEnvironment = process.env.MERCADO_PAGO_ENVIRONMENT;
  const mpCredentials =
    (configured("MERCADO_PAGO_PUBLIC_KEY") ||
      configured("NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY")) &&
    configured("MERCADO_PAGO_ACCESS_TOKEN") &&
    configured("MERCADO_PAGO_WEBHOOK_SECRET");
  const emailConfigured =
    configured("RESEND_API_KEY") && configured("EMAIL_FROM");
  return [
    {
      id: "alibaba",
      name: "Alibaba",
      section: "Fornecedores",
      status: !Object.values({
        import: flags.ALIBABA_PRODUCT_IMPORT,
        freight: flags.ALIBABA_FREIGHT_QUOTE,
        tracking: flags.ALIBABA_TRACKING,
        orderCreate: flags.ALIBABA_ORDER_CREATE,
        orderPay: flags.ALIBABA_ORDER_PAY,
      }).some(Boolean)
        ? "DISABLED"
        : alibabaCredentials
          ? "CONFIGURED"
          : "NOT_CONFIGURED",
      health:
        !flags.ALIBABA_PRODUCT_IMPORT &&
        !flags.ALIBABA_FREIGHT_QUOTE &&
        !flags.ALIBABA_TRACKING &&
        !flags.ALIBABA_ORDER_CREATE &&
        !flags.ALIBABA_ORDER_PAY
          ? "DISABLED"
          : alibabaCredentials
            ? "DEGRADED"
            : "NOT_CONFIGURED",
      detail: alibabaCredentials
        ? "Credenciais presentes; conectividade externa não foi sondada."
        : "Credenciais ausentes ou incompletas.",
      configured: {
        appKey: configured("ALIBABA_APP_KEY"),
        appSecret: configured("ALIBABA_APP_SECRET"),
      },
      capabilities: {
        import: flags.ALIBABA_PRODUCT_IMPORT,
        freight: flags.ALIBABA_FREIGHT_QUOTE,
        tracking: flags.ALIBABA_TRACKING,
        orderCreate: flags.ALIBABA_ORDER_CREATE,
        orderPay: flags.ALIBABA_ORDER_PAY,
      },
    },
    {
      id: "cj",
      name: "CJdropshipping",
      section: "Fornecedores",
      status: !flags.CJ_ENABLED
        ? "DISABLED"
        : cjCredentials
          ? "CONFIGURED"
          : "NOT_CONFIGURED",
      health: !flags.CJ_ENABLED
        ? "DISABLED"
        : cjCredentials
          ? "DEGRADED"
          : "NOT_CONFIGURED",
      detail: cjCredentials
        ? "Foundation configurada; sem declaração de conexão até health check oficial."
        : "Foundation offline disponível; credenciais não configuradas.",
      configured: {
        apiKey: configured("CJ_API_KEY"),
        accessToken: configured("CJ_ACCESS_TOKEN"),
        baseUrl: configured("CJ_BASE_URL"),
      },
      capabilities: {
        productImport: flags.CJ_PRODUCT_IMPORT,
        stock: flags.CJ_STOCK,
        shipping: flags.CJ_SHIPPING,
        tracking: flags.CJ_TRACKING,
        orderCreate: flags.CJ_ORDER_CREATE,
        orderPay: flags.CJ_ORDER_PAY,
      },
    },
    {
      id: "brazil-stock",
      name: "BRAZIL_STOCK",
      section: "Fornecedores",
      status: "CONFIGURED",
      health: "HEALTHY",
      detail:
        "Operação manual por fornecedores e ofertas nacionais; sem ERP/NF-e automático.",
      configured: {},
      capabilities: {
        manualSupplier: true,
        stock: true,
        price: true,
        deliveryEstimate: true,
        tracking: true,
        nfe: false,
      },
    },
    {
      id: "mercado-pago",
      name: "Mercado Pago",
      section: "Pagamentos",
      status: !flags.MERCADO_PAGO_ENABLED
        ? "DISABLED"
        : mpEnvironment !== "TEST"
          ? "UNAVAILABLE"
          : mpCredentials
            ? "CONFIGURED"
            : "NOT_CONFIGURED",
      health: !flags.MERCADO_PAGO_ENABLED
        ? "DISABLED"
        : mpEnvironment !== "TEST"
          ? "UNAVAILABLE"
          : mpCredentials
            ? "DEGRADED"
            : "NOT_CONFIGURED",
      detail:
        mpEnvironment === "TEST"
          ? "Somente TEST; produção permanece bloqueada."
          : "Ambiente não é TEST: cobrança bloqueada por segurança.",
      configured: {
        publicKey:
          configured("MERCADO_PAGO_PUBLIC_KEY") ||
          configured("NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY"),
        accessToken: configured("MERCADO_PAGO_ACCESS_TOKEN"),
        webhookSecret: configured("MERCADO_PAGO_WEBHOOK_SECRET"),
      },
      capabilities: {
        pix: flags.MERCADO_PAGO_PIX,
        card: flags.MERCADO_PAGO_CARD,
        boleto: flags.MERCADO_PAGO_BOLETO,
        testEnvironment: mpEnvironment === "TEST",
      },
    },
    {
      id: "shipping",
      name: "Shipping Engine",
      section: "Logística",
      status: "CONFIGURED",
      health: "HEALTHY",
      detail: "Cotações manuais persistidas e roteamento por oferta.",
      configured: {},
      capabilities: { quote: true, multiPackage: true, tracking: true },
    },
    {
      id: "tracking",
      name: "Tracking",
      section: "Logística",
      status: "CONFIGURED",
      health: "HEALTHY",
      detail: "DTO público sanitizado; providers reais continuam sob flags.",
      configured: {},
      capabilities: {
        publicTracking: true,
        alibaba: flags.ALIBABA_TRACKING,
        cj: flags.CJ_TRACKING,
      },
    },
    {
      id: "email",
      name: "E-mail transacional",
      section: "Comunicação",
      status: !flags.EMAIL_ENABLED
        ? "DISABLED"
        : flags.RESEND_ENABLED && emailConfigured
          ? "CONFIGURED"
          : "NOT_CONFIGURED",
      health: !flags.EMAIL_ENABLED
        ? "DISABLED"
        : flags.RESEND_ENABLED && emailConfigured
          ? "DEGRADED"
          : "NOT_CONFIGURED",
      detail: flags.EMAIL_ENABLED
        ? "Envio exige provider configurado; TestEmailProvider é somente offline."
        : "Envio desligado por padrão.",
      configured: {
        apiKey: configured("RESEND_API_KEY"),
        from: configured("EMAIL_FROM"),
      },
      capabilities: {
        transactional: flags.EMAIL_ENABLED,
        resend: flags.RESEND_ENABLED,
        offlinePreview: process.env.APP_ENV !== "production",
      },
    },
  ];
}

export function sanitizedOperationalConfig() {
  const flags = parseFeatureFlags(process.env);
  return {
    environment: process.env.APP_ENV ?? "development",
    store: {
      name: process.env.STORE_NAME?.trim() || "ACHILLES STORE",
      currency: "BRL",
      country: "BR",
      supportEmail: process.env.STORE_SUPPORT_EMAIL?.trim() || null,
      supportPhone: process.env.STORE_SUPPORT_PHONE?.trim() || null,
      publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || null,
      storefrontBaseUrl: process.env.STOREFRONT_BASE_URL?.trim() || null,
      defaultShippingPolicy:
        process.env.DEFAULT_SHIPPING_POLICY?.trim() || "MANUAL_REVIEW",
      preferBrazilStockWhenCompetitive:
        flags.PREFER_BRAZIL_STOCK_WHEN_COMPETITIVE,
      orderApprovalMode: process.env.ORDER_APPROVAL_MODE?.trim() || "MANUAL",
      defaultTaxMode: process.env.DEFAULT_TAX_MODE?.trim() || "MANUAL_QUOTE",
    },
    secrets: {
      alibabaAppKey: maskConfigured("ALIBABA_APP_KEY"),
      alibabaAppSecret: maskConfigured("ALIBABA_APP_SECRET"),
      cjApiKey: maskConfigured("CJ_API_KEY"),
      cjAccessToken: maskConfigured("CJ_ACCESS_TOKEN"),
      mercadoPagoAccessToken: maskConfigured("MERCADO_PAGO_ACCESS_TOKEN"),
      mercadoPagoWebhookSecret: maskConfigured("MERCADO_PAGO_WEBHOOK_SECRET"),
      resendApiKey: maskConfigured("RESEND_API_KEY"),
    },
    flags,
    readOnly: true,
  };
}
