import type {
  CreateProviderPaymentInput,
  CustomerPaymentProvider,
  PaymentCapabilitiesDTO,
  ProviderPaymentResult,
} from "@achilles/domain";

export class FakePaymentProvider implements CustomerPaymentProvider {
  readonly name = "TEST" as const;
  createPaymentIntent(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentResult> {
    if (input.method === "CARD") {
      const approved = input.card?.token === "tok_test_approved";
      const failed = input.card?.token === "tok_test_declined";
      return Promise.resolve({
        providerOrderId: `test_order_${input.idempotencyKey.slice(0, 20)}`,
        status: approved ? "PAID" : failed ? "FAILED" : "PROCESSING",
        providerStatus: approved
          ? "accredited"
          : failed
            ? "rejected"
            : "processing",
        failureCode: failed ? "CARD_DECLINED" : undefined,
        failureMessageSafe: failed
          ? "Pagamento recusado. Tente outro cartão ou Pix."
          : undefined,
        installments: input.card
          ? [
              {
                count: input.card.installments,
                installmentAmount: money(
                  Number(input.amount) / input.card.installments,
                ),
                total: money(Number(input.amount)),
                fees: money(0),
              },
            ]
          : [],
      });
    }
    return Promise.resolve({
      providerOrderId: `test_order_${input.idempotencyKey.slice(0, 20)}`,
      status: "PENDING",
      providerStatus: "waiting_transfer",
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      pix: {
        qrCode: `TEST-PIX-${input.externalReference}`,
        testOnly: true,
      },
    });
  }
  getPaymentStatus(providerOrderId: string): Promise<ProviderPaymentResult> {
    const status = providerOrderId.endsWith("_paid")
      ? "PAID"
      : providerOrderId.endsWith("_failed")
        ? "FAILED"
        : providerOrderId.endsWith("_expired")
          ? "EXPIRED"
          : "PENDING";
    return Promise.resolve({
      providerOrderId,
      status,
      providerStatus:
        status === "PENDING"
          ? "waiting_transfer"
          : `test_${status.toLowerCase()}`,
    });
  }
  cancelPayment(providerOrderId: string): Promise<ProviderPaymentResult> {
    return Promise.resolve({
      providerOrderId,
      status: "CANCELLED",
      providerStatus: "cancelled",
    });
  }
  refundPayment(): Promise<never> {
    return Promise.reject(new Error("REFUND_NOT_IMPLEMENTED"));
  }
  getCapabilities(): PaymentCapabilitiesDTO {
    return {
      provider: "TEST",
      testMode: true,
      health: "HEALTHY",
      methods: { pix: true, card: true, boleto: false },
      publicKey: null,
    };
  }
}

function money(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  return {
    amount: rounded,
    currencyCode: "brl" as const,
    formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(rounded),
  };
}
