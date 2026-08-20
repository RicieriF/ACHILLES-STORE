"use client";

import type {
  PaymentCapabilitiesDTO,
  PublicCheckoutDTO,
  PublicPaymentIntentDTO,
} from "@achilles/domain";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Container,
  Input,
} from "../../../components/ui/primitives";

const checkoutStorageKey = "achilles_checkout_id";
type Method = "PIX" | "CARD";
export function PaymentClient() {
  const router = useRouter();
  const [checkout, setCheckout] = useState<PublicCheckoutDTO | null>(null);
  const [capabilities, setCapabilities] =
    useState<PaymentCapabilitiesDTO | null>(null);
  const [payment, setPayment] = useState<PublicPaymentIntentDTO | null>(null);
  const [method, setMethod] = useState<Method>("PIX");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());

  useEffect(() => {
    const id = localStorage.getItem(checkoutStorageKey);
    if (!id) {
      void Promise.resolve().then(() => {
        setError("Checkout não encontrado.");
        setLoading(false);
      });
      return;
    }
    Promise.all([
      request<PublicCheckoutDTO>(`/api/checkout/${id}`, "checkout"),
      request<PaymentCapabilitiesDTO>(
        "/api/payment/capabilities",
        "capabilities",
      ),
    ])
      .then(([checkoutValue, capabilityValue]) => {
        setCheckout(checkoutValue);
        setCapabilities(capabilityValue);
      })
      .catch((caught: unknown) => setError(messageOf(caught)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!payment || !["PENDING", "PROCESSING"].includes(payment.status)) return;
    const timer = window.setInterval(() => {
      void request<PublicPaymentIntentDTO>(
        `/api/payment/${payment.id}/status`,
        "paymentIntent",
      )
        .then((value) => {
          setPayment(value);
          if (value.status === "PAID")
            router.push(
              `/pedido/confirmado?payment=${encodeURIComponent(value.id)}`,
            );
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [payment, router]);

  async function create(body: object) {
    if (!checkout) return;
    setLoading(true);
    setError(null);
    try {
      const value = await request<PublicPaymentIntentDTO>(
        "/api/payment",
        "paymentIntent",
        {
          method: "POST",
          body: JSON.stringify({
            checkoutId: checkout.id,
            method,
            attemptId: attempt.current,
            ...body,
          }),
        },
      );
      setPayment(value);
      if (value.status === "PAID")
        router.push(
          `/pedido/confirmado?payment=${encodeURIComponent(value.id)}`,
        );
      if (value.status === "FAILED") {
        setError(value.failureMessage ?? "Pagamento recusado.");
        attempt.current = crypto.randomUUID();
      }
    } catch (caught) {
      setError(messageOf(caught));
      attempt.current = crypto.randomUUID();
    } finally {
      setLoading(false);
    }
  }

  if (loading && !checkout)
    return (
      <main id="conteudo" className="checkout-shell">
        <Container>
          <p role="status">Preparando pagamento seguro…</p>
        </Container>
      </main>
    );
  if (!checkout || !capabilities)
    return (
      <main id="conteudo" className="checkout-shell">
        <Container>
          <Alert tone="error">{error ?? "Pagamento indisponível"}</Alert>
        </Container>
      </main>
    );
  return (
    <main id="conteudo" className="checkout-shell">
      <Container>
        <div className="checkout-heading">
          <p className="eyebrow">Checkout seguro</p>
          <h1>Pagamento</h1>
          <p>
            Pix primeiro, sem impedir sua escolha de cartão. O status confirmado
            sempre vem do servidor.
          </p>
        </div>
        {capabilities.testMode && (
          <Alert tone="info">
            Ambiente de TESTE — nenhuma cobrança real será feita.
          </Alert>
        )}
        {capabilities.health !== "HEALTHY" && (
          <Alert tone="error">
            Pagamento temporariamente indisponível. Seu carrinho foi preservado.
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="checkout-layout">
          <section className="checkout-card">
            <div
              className="payment-tabs"
              role="tablist"
              aria-label="Meio de pagamento"
            >
              <button
                type="button"
                role="tab"
                aria-selected={method === "PIX"}
                disabled={!capabilities.methods.pix}
                onClick={() => setMethod("PIX")}
              >
                Pix
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === "CARD"}
                disabled={!capabilities.methods.card}
                onClick={() => setMethod("CARD")}
              >
                Cartão
              </button>
            </div>
            {payment?.status === "PENDING" && payment.method === "PIX" ? (
              <PixPending payment={payment} />
            ) : method === "PIX" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void create({ cpf });
                }}
              >
                <h2>Pix</h2>
                <p>O pagamento só será confirmado após retorno do provedor.</p>
                <Input
                  id="payment-cpf"
                  label="CPF"
                  value={cpf}
                  onChange={(event) => setCpf(maskCpfInput(event.target.value))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  required
                />
                <Button
                  type="submit"
                  loading={loading}
                  disabled={loading || !capabilities.methods.pix}
                >
                  Gerar Pix
                </Button>
              </form>
            ) : capabilities.provider === "TEST" ? (
              <TestCard
                loading={loading}
                onPay={(token, installments) =>
                  void create({
                    card: { token, paymentMethodId: "master", installments },
                  })
                }
              />
            ) : capabilities.publicKey ? (
              <MercadoPagoCard
                publicKey={capabilities.publicKey}
                amount={checkout.totals?.total.amount ?? 0}
                loading={loading}
                onToken={(card) => void create({ card })}
              />
            ) : (
              <Alert tone="error">
                Chave pública de teste não configurada.
              </Alert>
            )}
            {payment?.status === "FAILED" && (
              <Button
                type="button"
                onClick={() => {
                  setPayment(null);
                  attempt.current = crypto.randomUUID();
                }}
              >
                Tentar novamente
              </Button>
            )}
          </section>
          <Summary checkout={checkout} />
        </div>
      </Container>
    </main>
  );
}

function PixPending({ payment }: { payment: PublicPaymentIntentDTO }) {
  return (
    <div className="pix-panel">
      <h2>Aguardando pagamento</h2>
      {payment.pix?.testOnly ? (
        <div className="test-qr" aria-label="QR Pix de teste não pagável">
          QR TESTE
          <br />
          NÃO PAGÁVEL
        </div>
      ) : payment.pix?.qrCodeBase64 ? (
        <Image
          src={`data:image/png;base64,${payment.pix.qrCodeBase64}`}
          alt="QR Code Pix"
          width={256}
          height={256}
          unoptimized
        />
      ) : null}
      <p>
        <strong>{payment.amount.formatted}</strong>
      </p>
      <label htmlFor="pix-code">Pix copia e cola</label>
      <textarea
        id="pix-code"
        readOnly
        value={payment.pix?.qrCode ?? "Aguardando dados do provedor"}
      />
      <Button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(payment.pix?.qrCode ?? "")
        }
      >
        Copiar código Pix
      </Button>
      <p>
        Expira em:{" "}
        {payment.expiresAt
          ? new Date(payment.expiresAt).toLocaleString("pt-BR")
          : "informado pelo provedor"}
      </p>
      <p role="status">Atualizando status com segurança…</p>
    </div>
  );
}
function TestCard({
  loading,
  onPay,
}: {
  loading: boolean;
  onPay: (token: string, installments: number) => void;
}) {
  const [installments, setInstallments] = useState(1);
  return (
    <div>
      <h2>Cartão · TESTE</h2>
      <label htmlFor="test-installments">
        Parcelas permitidas pelo fixture
      </label>
      <select
        id="test-installments"
        value={installments}
        onChange={(e) => setInstallments(Number(e.target.value))}
      >
        <option value="1">1× sem taxa no fixture</option>
        <option value="2">2× sem taxa no fixture</option>
      </select>
      <Button
        type="button"
        loading={loading}
        onClick={() => onPay("tok_test_approved", installments)}
      >
        Aprovar cartão de teste
      </Button>
      <Button
        type="button"
        disabled={loading}
        onClick={() => onPay("tok_test_declined", installments)}
      >
        Simular cartão recusado
      </Button>
      <p>Nenhum dado real de cartão é coletado neste fixture.</p>
    </div>
  );
}
type CardToken = {
  token: string;
  paymentMethodId: string;
  installments: number;
};
function MercadoPagoCard({
  publicKey,
  amount,
  loading,
  onToken,
}: {
  publicKey: string;
  amount: number;
  loading: boolean;
  onToken: (card: CardToken) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let controller: { unmount?: () => void } | undefined;
    const setup = async () => {
      await loadMercadoPagoScript();
      const Constructor = window.MercadoPago;
      if (!Constructor) throw new Error("SDK indisponível");
      const mp = new Constructor(publicKey, { locale: "pt-BR" });
      controller = await mp
        .bricks()
        .create("cardPayment", "cardPaymentBrick_container", {
          initialization: { amount },
          callbacks: {
            onReady: () => undefined,
            onError: () =>
              setError("Não foi possível carregar o formulário seguro."),
            onSubmit: (data: unknown) => {
              const card = parseBrickToken(data);
              if (!card) {
                setError("Tokenização não concluída.");
                return;
              }
              onToken(card);
            },
          },
        });
    };
    void setup().catch(() => setError("MercadoPago.js indisponível."));
    return () => controller?.unmount?.();
  }, [amount, onToken, publicKey]);
  return (
    <div>
      <h2>Cartão</h2>
      <p>
        Os campos são hospedados pelo Mercado Pago; a Achilles recebe apenas um
        token.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div id="cardPaymentBrick_container" aria-busy={loading} />
    </div>
  );
}
function Summary({ checkout }: { checkout: PublicCheckoutDTO }) {
  return (
    <aside className="checkout-summary">
      <p className="eyebrow">Resumo</p>
      <h2>{checkout.totals?.total.formatted}</h2>
      <p>
        Entrega:{" "}
        {checkout.shippingSelections.map((item) => item.methodName).join(" · ")}
      </p>
      <p>Tributos: {checkout.totals?.taxes.label}</p>
    </aside>
  );
}
function maskCpfInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
async function request<T>(
  url: string,
  key: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      isObject(body) && typeof body.message === "string"
        ? body.message
        : "Operação indisponível",
    );
  if (!isObject(body) || !(key in body)) throw new Error("Resposta inválida");
  return body[key] as T;
}
function parseBrickToken(value: unknown): CardToken | null {
  if (
    !isObject(value) ||
    typeof value.token !== "string" ||
    typeof value.payment_method_id !== "string" ||
    typeof value.installments !== "number"
  )
    return null;
  return {
    token: value.token,
    paymentMethodId: value.payment_method_id,
    installments: value.installments,
  };
}
function loadMercadoPagoScript(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK indisponível"));
    document.head.appendChild(script);
  });
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function messageOf(value: unknown) {
  return value instanceof Error ? value.message : "Pagamento indisponível";
}
declare global {
  interface Window {
    MercadoPago?: new (
      key: string,
      options: { locale: string },
    ) => {
      bricks(): {
        create(
          type: string,
          id: string,
          settings: object,
        ): Promise<{ unmount?: () => void }>;
      };
    };
  }
}
