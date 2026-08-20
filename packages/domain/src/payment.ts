import type { PublicMoneyDTO } from "./public-catalog.js";

export const paymentIntentStatuses = [
  "CREATED",
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
] as const;
export type PaymentIntentStatus = (typeof paymentIntentStatuses)[number];
export type PaymentMethod = "PIX" | "CARD" | "BOLETO";
export type PaymentProviderHealth =
  "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "DISABLED";
export type TaxpayerIdentityType = "CPF" | "CNPJ" | "PASSPORT_FUTURE";
export type FulfillmentTaxMode =
  | "CUSTOMER_AS_IMPORTER"
  | "MERCHANT_AS_IMPORTER"
  | "DDP_CONFIRMED"
  | "DOMESTIC_FULFILLMENT"
  | "UNKNOWN";

export type PaymentInstallmentDTO = {
  count: number;
  installmentAmount: PublicMoneyDTO;
  total: PublicMoneyDTO;
  fees: PublicMoneyDTO;
};

export type PaymentCapabilitiesDTO = {
  provider: "MERCADO_PAGO" | "TEST" | "NONE";
  testMode: boolean;
  health: PaymentProviderHealth;
  methods: { pix: boolean; card: boolean; boleto: boolean };
  publicKey: string | null;
};

export type PublicPaymentIntentDTO = {
  id: string;
  checkoutId: string;
  provider: "MERCADO_PAGO" | "TEST";
  method: PaymentMethod;
  amount: PublicMoneyDTO;
  status: PaymentIntentStatus;
  providerStatus: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  taxpayerIdentityMasked: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  testMode: boolean;
  pix: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    ticketUrl: string | null;
    testOnly: boolean;
  } | null;
  installments: readonly PaymentInstallmentDTO[];
};

export type CreateProviderPaymentInput = {
  idempotencyKey: string;
  externalReference: string;
  method: PaymentMethod;
  amount: string;
  currency: "BRL";
  payer: {
    email: string;
    taxpayerType?: "CPF" | undefined;
    taxpayerId?: string | undefined;
  };
  card?:
    | { token: string; paymentMethodId: string; installments: number }
    | undefined;
};

export type ProviderPaymentResult = {
  providerOrderId: string;
  status: PaymentIntentStatus;
  providerStatus: string;
  failureCode?: string | undefined;
  failureMessageSafe?: string | undefined;
  expiresAt?: string | undefined;
  pix?:
    | {
        qrCode?: string | undefined;
        qrCodeBase64?: string | undefined;
        ticketUrl?: string | undefined;
        testOnly: boolean;
      }
    | undefined;
  installments?: readonly PaymentInstallmentDTO[] | undefined;
};

export interface CustomerPaymentProvider {
  readonly name: "MERCADO_PAGO" | "TEST";
  createPaymentIntent(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentResult>;
  getPaymentStatus(providerOrderId: string): Promise<ProviderPaymentResult>;
  cancelPayment(providerOrderId: string): Promise<ProviderPaymentResult>;
  refundPayment(providerOrderId: string): Promise<never>;
  getCapabilities(): PaymentCapabilitiesDTO;
}
