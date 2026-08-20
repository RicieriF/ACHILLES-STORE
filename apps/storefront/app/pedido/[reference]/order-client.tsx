"use client";

import type { PublicCustomerOrderDTO } from "@achilles/domain";
import { useEffect, useState } from "react";
import { Alert, Container } from "../../../components/ui/primitives";

export function OrderClient({
  reference,
  token,
}: {
  reference: string;
  token: string;
}) {
  const [order, setOrder] = useState<PublicCustomerOrderDTO | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : "Link seguro do pedido inválido.",
  );
  useEffect(() => {
    if (!token) return;
    fetch(
      `/api/orders/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`,
    )
      .then(async (response) => {
        const body = (await response.json()) as {
          order?: PublicCustomerOrderDTO;
          message?: string;
        };
        if (!response.ok || !body.order)
          throw new Error(body.message ?? "Pedido não encontrado");
        setOrder(body.order);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Pedido indisponível",
        ),
      );
  }, [reference, token]);
  if (error)
    return (
      <main className="checkout-shell">
        <Container>
          <Alert tone="error">{error}</Alert>
        </Container>
      </main>
    );
  if (!order)
    return (
      <main className="checkout-shell">
        <Container>
          <p>Carregando pedido…</p>
        </Container>
      </main>
    );
  return (
    <main className="checkout-shell">
      <Container>
        <div className="checkout-card">
          <p className="eyebrow">ACOMPANHAMENTO SEGURO</p>
          <h1>Pedido {order.reference}</h1>
          <p>
            <strong>Status:</strong> {statusLabel(order.status)}
          </p>
          <p>
            <strong>Pagamento:</strong> {order.payment.status} ·{" "}
            {order.total.formatted}
          </p>
        </div>
      </Container>
      <Container>
        <div className="checkout-card">
          <h2>Itens</h2>
          {order.items.map((item, index) => (
            <p key={`${item.title}-${String(index)}`}>
              {item.quantity}× {item.title} · {item.variantTitle} ·{" "}
              {item.unitPrice.formatted}
            </p>
          ))}
        </div>
      </Container>
      <Container>
        <div className="checkout-card">
          <h2>Pacotes e rastreamento</h2>
          {order.shipping.map((shipment) => (
            <p key={shipment.package}>
              <strong>{shipment.package}</strong> · {shipment.method} ·{" "}
              {shipment.eta}
            </p>
          ))}
          {order.tracking.length === 0 ? (
            <Alert tone="info">
              Rastreamento será exibido após a postagem.
            </Alert>
          ) : (
            order.tracking.map((tracking) => (
              <p key={tracking.trackingNumber}>
                <strong>{tracking.package}</strong> · {tracking.status} ·{" "}
                {tracking.carrier} · {tracking.trackingNumber}
              </p>
            ))
          )}
        </div>
      </Container>
    </main>
  );
}

function statusLabel(status: PublicCustomerOrderDTO["status"]): string {
  const labels: Record<PublicCustomerOrderDTO["status"], string> = {
    PAYMENT_PENDING: "Aguardando pagamento",
    PAID: "Pagamento confirmado",
    FULFILLMENT_REVIEW: "Em revisão operacional",
    SUPPLIER_APPROVAL_REQUIRED: "Preparando envio",
    SUPPLIER_APPROVED: "Preparando envio",
    ORDERING_SUPPLIER: "Preparando envio",
    SUPPLIER_CONFIRMED: "Pedido confirmado",
    IN_FULFILLMENT: "Em preparação",
    SHIPPED: "Enviado",
    DELIVERED: "Entregue",
    EXCEPTION: "Em análise",
    CANCELLED: "Cancelado",
  };
  return labels[status];
}
