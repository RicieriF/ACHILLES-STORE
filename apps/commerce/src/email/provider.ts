export const transactionalEmailEvents = [
  "ORDER_RECEIVED",
  "PAYMENT_APPROVED",
  "PIX_PENDING",
  "PAYMENT_DECLINED",
  "ORDER_SHIPPED",
  "TRACKING_AVAILABLE",
] as const;
export type TransactionalEmailEvent = (typeof transactionalEmailEvents)[number];
export type TransactionalEmailMessage = {
  event: TransactionalEmailEvent;
  to: string;
  customerName: string;
  orderReference: string;
  trackingCode?: string | undefined;
};
export interface TransactionalEmailProvider {
  readonly provider: "TEST" | "RESEND";
  send(
    message: TransactionalEmailMessage,
  ): Promise<{ id: string; preview: string; delivered: boolean }>;
}

const subjects: Record<TransactionalEmailEvent, string> = {
  ORDER_RECEIVED: "Recebemos seu pedido",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PIX_PENDING: "Pix aguardando pagamento",
  PAYMENT_DECLINED: "Pagamento não aprovado",
  ORDER_SHIPPED: "Seu pedido foi enviado",
  TRACKING_AVAILABLE: "Rastreamento disponível",
};

export function renderAchillesEmail(
  message: TransactionalEmailMessage,
): string {
  const safeName = sanitize(message.customerName);
  const safeReference = sanitize(message.orderReference);
  const safeTracking = message.trackingCode
    ? ` Código: ${sanitize(message.trackingCode)}.`
    : "";
  return `ACHILLES STORE — ${subjects[message.event]}\nOlá, ${safeName}. Pedido ${safeReference}.${safeTracking}\nProteção e confiança em cada jornada.`;
}

export class TestEmailProvider implements TransactionalEmailProvider {
  readonly provider = "TEST" as const;
  send(message: TransactionalEmailMessage) {
    if ((process.env.APP_ENV ?? process.env.NODE_ENV) === "production")
      return Promise.reject(
        new Error("TEST_EMAIL_PROVIDER_FORBIDDEN_IN_PRODUCTION"),
      );
    const preview = renderAchillesEmail({
      ...message,
      to: "redacted@example.invalid",
    });
    return Promise.resolve({
      id: `test-email-${message.event.toLowerCase()}`,
      preview,
      delivered: false,
    });
  }
}

export class ResendEmailProvider implements TransactionalEmailProvider {
  readonly provider = "RESEND" as const;
  send(_message: TransactionalEmailMessage): Promise<never> {
    return Promise.reject(
      new Error(
        "RESEND_DELIVERY_NOT_IMPLEMENTED_WITHOUT_APPROVED_CREDENTIAL_VALIDATION",
      ),
    );
  }
}

function sanitize(value: string): string {
  return value.replace(/[<>\r\n]/g, "").slice(0, 160);
}
