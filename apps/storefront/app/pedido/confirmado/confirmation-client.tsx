"use client";
import type {
  PublicCheckoutDTO,
  PublicPaymentIntentDTO,
} from "@achilles/domain";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Container } from "../../../components/ui/primitives";
export function ConfirmationClient() {
  const id = useSearchParams().get("payment");
  const [data, setData] = useState<{
    payment: PublicPaymentIntentDTO;
    checkout: PublicCheckoutDTO;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/payment/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const body = (await r.json()) as {
          paymentIntent?: PublicPaymentIntentDTO;
        };
        if (!r.ok || !body.paymentIntent)
          throw new Error("Pagamento não encontrado");
        const checkoutResponse = await fetch(
          `/api/checkout/${body.paymentIntent.checkoutId}`,
        );
        const checkoutBody = (await checkoutResponse.json()) as {
          checkout?: PublicCheckoutDTO;
        };
        if (!checkoutBody.checkout) throw new Error("Checkout não encontrado");
        setData({
          payment: body.paymentIntent,
          checkout: checkoutBody.checkout,
        });
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Confirmação indisponível"),
      );
  }, [id]);
  if (!id)
    return (
      <main className="checkout-shell">
        <Container>
          <Alert tone="error">Referência de pagamento ausente.</Alert>
        </Container>
      </main>
    );
  if (error)
    return (
      <main className="checkout-shell">
        <Container>
          <Alert tone="error">{error}</Alert>
        </Container>
      </main>
    );
  if (!data)
    return (
      <main className="checkout-shell">
        <Container>
          <p>Confirmando status com o servidor…</p>
        </Container>
      </main>
    );
  if (data.payment.status !== "PAID")
    return (
      <main className="checkout-shell">
        <Container>
          <Alert tone="info">
            Aguardando pagamento. Esta página não confirma um pedido antes do
            provedor.
          </Alert>
          <Link className="button" href="/checkout/pagamento">
            Voltar ao pagamento
          </Link>
        </Container>
      </main>
    );
  const address = data.checkout.address;
  return (
    <main className="checkout-shell">
      <Container>
        <div className="checkout-card ready-panel">
          <span>✓</span>
          <h1>Pagamento confirmado</h1>
          <p>
            Pedido: <strong>{data.payment.customerOrder?.reference}</strong>
          </p>
          <p>
            <strong>{data.payment.amount.formatted}</strong> ·{" "}
            {data.payment.method}
          </p>
          <p>
            Entrega:{" "}
            {data.checkout.shippingSelections
              .map((item) => item.methodName)
              .join(" · ")}
          </p>
          {address && (
            <p>
              Endereço: {address.street.slice(0, 3)}***, *** · {address.city}/
              {address.state} · CEP ***{address.postalCode.slice(-3)}
            </p>
          )}
          <Alert tone="info">
            Pedido recebido. A compra junto ao fornecedor depende de revisão e
            aprovação humana; nenhuma execução real é automática.
          </Alert>
          {data.payment.customerOrder && (
            <Link
              className="button"
              href={`/pedido/${data.payment.customerOrder.reference}?token=${encodeURIComponent(data.payment.customerOrder.accessToken)}`}
            >
              Acompanhar pedido
            </Link>
          )}
          <Link className="button button--secondary" href="/">
            Voltar à loja
          </Link>
        </div>
      </Container>
    </main>
  );
}
