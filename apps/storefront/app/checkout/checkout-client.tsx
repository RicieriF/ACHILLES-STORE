"use client";

import type { PublicCheckoutDTO } from "@achilles/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Container,
  Input,
  Select,
} from "../../components/ui/primitives";

type Step = "contact" | "address" | "shipping" | "review";
const checkoutStorageKey = "achilles_checkout_id";
const cartStorageKey = "achilles_cart_id";
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export function CheckoutClient() {
  const [checkout, setCheckout] = useState<PublicCheckoutDTO | null>(null);
  const [step, setStep] = useState<Step>("contact");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cartId = window.localStorage.getItem(cartStorageKey);
    const checkoutId = window.localStorage.getItem(checkoutStorageKey);
    if (!cartId) {
      void Promise.resolve().then(() => {
        setError("Seu carrinho não foi encontrado.");
        setLoading(false);
      });
      return;
    }
    const recovery = checkoutId
      ? requestCheckout(`/api/checkout/${encodeURIComponent(checkoutId)}`)
      : Promise.reject(new Error("Nova sessão"));
    recovery
      .catch(() =>
        requestCheckout("/api/checkout", {
          method: "POST",
          body: JSON.stringify({ cartId }),
        }),
      )
      .then((value) => {
        if (value.cartId !== cartId)
          throw new Error("A sessão pertence a outro carrinho");
        window.localStorage.setItem(checkoutStorageKey, value.id);
        setCheckout(value);
        setStep(stepFor(value));
      })
      .catch((caught: unknown) => setError(messageOf(caught)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && checkout)
      document
        .getElementById("checkout-step-heading")
        ?.focus({ preventScroll: true });
  }, [checkout, loading, step]);

  async function run(operation: () => Promise<PublicCheckoutDTO>, next?: Step) {
    setLoading(true);
    setError(null);
    try {
      const value = await operation();
      setCheckout(value);
      setStep(next ?? stepFor(value));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !checkout)
    return (
      <main id="conteudo" className="checkout-shell">
        <Container>
          <p role="status">Preparando checkout seguro…</p>
        </Container>
      </main>
    );
  if (!checkout)
    return (
      <main id="conteudo" className="checkout-shell">
        <Container>
          <Alert tone="error">{error ?? "Checkout indisponível"}</Alert>
          <Link className="button button--secondary" href="/">
            Voltar à loja
          </Link>
        </Container>
      </main>
    );

  const ready = checkout.status === "READY_FOR_PAYMENT";
  return (
    <main id="conteudo" className="checkout-shell">
      <Container>
        <div className="checkout-heading">
          <p className="eyebrow">Checkout guest · Brasil</p>
          <h1>
            {ready
              ? "Tudo pronto para a próxima etapa"
              : "Finalize sua jornada"}
          </h1>
          <p>
            Seus dados ficam protegidos no servidor e não são enviados a
            fornecedores nesta etapa.
          </p>
        </div>
        <Progress
          step={step}
          ready={ready}
          onStep={setStep}
          checkout={checkout}
        />
        {error && <Alert tone="error">{error}</Alert>}
        {checkout.notice && (
          <Alert tone={ready ? "success" : "info"}>{checkout.notice}</Alert>
        )}
        <div className="checkout-layout">
          <section className="checkout-card" aria-busy={loading}>
            {ready ? (
              <Ready checkout={checkout} />
            ) : step === "contact" ? (
              <Contact
                checkout={checkout}
                loading={loading}
                onSubmit={(body) =>
                  run(
                    () =>
                      requestCheckout(`/api/checkout/${checkout.id}/customer`, {
                        method: "PATCH",
                        body: JSON.stringify(body),
                      }),
                    "address",
                  )
                }
              />
            ) : step === "address" ? (
              <Address
                checkout={checkout}
                loading={loading}
                onSubmit={(body) =>
                  run(async () => {
                    await requestCheckout(
                      `/api/checkout/${checkout.id}/address`,
                      { method: "PATCH", body: JSON.stringify(body) },
                    );
                    return requestCheckout(
                      `/api/checkout/${checkout.id}/shipping/quote`,
                      { method: "POST" },
                    );
                  }, "shipping")
                }
              />
            ) : step === "shipping" ? (
              <Shipping
                checkout={checkout}
                loading={loading}
                onSelect={(groupId, quoteId) =>
                  run(
                    () =>
                      requestCheckout(
                        `/api/checkout/${checkout.id}/shipping/select`,
                        {
                          method: "POST",
                          body: JSON.stringify({ groupId, quoteId }),
                        },
                      ),
                    "shipping",
                  )
                }
                onReview={() =>
                  run(
                    () =>
                      requestCheckout(`/api/checkout/${checkout.id}/review`),
                    "review",
                  )
                }
                onRequote={() =>
                  run(
                    () =>
                      requestCheckout(
                        `/api/checkout/${checkout.id}/shipping/quote`,
                        { method: "POST" },
                      ),
                    "shipping",
                  )
                }
              />
            ) : (
              <Review
                checkout={checkout}
                loading={loading}
                onReady={() =>
                  run(
                    () =>
                      requestCheckout(`/api/checkout/${checkout.id}/ready`, {
                        method: "POST",
                      }),
                    "review",
                  )
                }
                onEditAddress={() => setStep("address")}
              />
            )}
          </section>
          <OrderSummary checkout={checkout} />
        </div>
      </Container>
    </main>
  );
}

function Progress({
  step,
  ready,
  onStep,
  checkout,
}: {
  step: Step;
  ready: boolean;
  onStep: (step: Step) => void;
  checkout: PublicCheckoutDTO;
}) {
  const current = ready
    ? 4
    : ["contact", "address", "shipping", "review"].indexOf(step);
  return (
    <nav className="checkout-progress" aria-label="Progresso do checkout">
      {(["Contato", "Entrega", "Frete", "Revisão"] as const).map(
        (label, index) => {
          const target =
            (["contact", "address", "shipping", "review"] as Step[])[index] ??
            "contact";
          const enabled =
            index <= current &&
            (index === 0 || checkout.customer !== null) &&
            (index < 2 || checkout.address !== null) &&
            (index < 3 || checkout.shippingGroups.length > 0);
          return (
            <button
              type="button"
              key={label}
              disabled={!enabled}
              aria-current={!ready && index === current ? "step" : undefined}
              onClick={() => onStep(target)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          );
        },
      )}
    </nav>
  );
}

function Contact({
  checkout,
  loading,
  onSubmit,
}: {
  checkout: PublicCheckoutDTO;
  loading: boolean;
  onSubmit: (body: object) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("tel"),
    });
  };
  return (
    <form onSubmit={submit}>
      <StepTitle
        number="01"
        title="Seus dados"
        text="Compra sem cadastro. Usaremos estes dados somente para seu pedido."
      />
      <Input
        id="checkout-name"
        name="name"
        label="Nome completo"
        autoComplete="name"
        required
        minLength={3}
        defaultValue={checkout.customer?.name}
      />
      <Input
        id="checkout-email"
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        required
        defaultValue={checkout.customer?.email}
      />
      <Input
        id="checkout-phone"
        name="tel"
        type="tel"
        label="Telefone brasileiro"
        autoComplete="tel"
        inputMode="tel"
        placeholder="(27) 99999-9999"
        required
        defaultValue={checkout.customer?.phone}
      />
      <Button type="submit" loading={loading} disabled={loading}>
        Continuar para entrega
      </Button>
    </form>
  );
}

function Address({
  checkout,
  loading,
  onSubmit,
}: {
  checkout: PublicCheckoutDTO;
  loading: boolean;
  onSubmit: (body: object) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      postalCode: data.get("postalCode"),
      street: data.get("street"),
      number: data.get("number"),
      complement: data.get("complement"),
      neighborhood: data.get("neighborhood"),
      city: data.get("city"),
      state: data.get("state"),
      countryCode: "BR",
    });
  };
  const address = checkout.address;
  return (
    <form onSubmit={submit}>
      <StepTitle
        number="02"
        title="Endereço de entrega"
        text="CEP e endereço brasileiro. A consulta externa de CEP não é necessária."
      />
      <div className="checkout-fields checkout-fields--split">
        <Input
          id="postal-code"
          name="postalCode"
          label="CEP"
          autoComplete="postal-code"
          inputMode="numeric"
          placeholder="29216-090"
          pattern="[0-9]{5}-?[0-9]{3}"
          required
          defaultValue={address?.postalCodeFormatted}
        />
        <Input
          id="country"
          name="country"
          label="País"
          value="Brasil"
          readOnly
        />
      </div>
      <Input
        id="street"
        name="street"
        label="Rua / logradouro"
        autoComplete="address-line1"
        required
        defaultValue={address?.street}
      />
      <div className="checkout-fields checkout-fields--number">
        <Input
          id="number"
          name="number"
          label="Número"
          required
          defaultValue={address?.number}
        />
        <Input
          id="complement"
          name="complement"
          label="Complemento (opcional)"
          autoComplete="address-line2"
          defaultValue={address?.complement ?? ""}
        />
      </div>
      <Input
        id="neighborhood"
        name="neighborhood"
        label="Bairro"
        required
        defaultValue={address?.neighborhood}
      />
      <div className="checkout-fields checkout-fields--split">
        <Input
          id="city"
          name="city"
          label="Cidade"
          autoComplete="address-level2"
          required
          defaultValue={address?.city}
        />
        <Select
          id="state"
          name="state"
          label="UF"
          autoComplete="address-level1"
          required
          defaultValue={address?.state ?? ""}
        >
          <option value="" disabled>
            Selecione
          </option>
          {states.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" loading={loading} disabled={loading}>
        Salvar e calcular frete
      </Button>
    </form>
  );
}

function Shipping({
  checkout,
  loading,
  onSelect,
  onReview,
  onRequote,
}: {
  checkout: PublicCheckoutDTO;
  loading: boolean;
  onSelect: (groupId: string, quoteId: string) => void;
  onReview: () => void;
  onRequote: () => void;
}) {
  const complete =
    checkout.shippingGroups.length > 0 &&
    checkout.shippingSelections.length === checkout.shippingGroups.length;
  return (
    <div>
      <StepTitle
        number="03"
        title="Escolha a entrega"
        text={
          checkout.shipmentType === "MULTI_SHIPMENT"
            ? "Seu pedido será enviado em mais de um pacote."
            : "Selecione a modalidade de entrega."
        }
      />
      {checkout.shippingGroups.length === 0 ? (
        <Alert tone="info">As opções precisam ser atualizadas.</Alert>
      ) : (
        checkout.shippingGroups.map((group) => (
          <fieldset className="checkout-package" key={group.id}>
            <legend>{group.label}</legend>
            <p>{group.itemLabels.join(", ")}</p>
            {group.methods.length === 0 ? (
              <Alert tone="error">Entrega indisponível para este pacote.</Alert>
            ) : (
              group.methods.map((method) => (
                <label className="shipping-method" key={method.id}>
                  <input
                    type="radio"
                    name={group.id}
                    checked={group.selectedMethodId === method.id}
                    disabled={loading}
                    onChange={() => onSelect(group.id, method.id)}
                  />
                  <span>
                    <strong>{method.name}</strong>
                    <small>
                      {method.estimatedMinimumDays}–
                      {method.estimatedMaximumDays} dias úteis ·{" "}
                      {method.dutiesNotice}
                    </small>
                  </span>
                  <strong>{method.price.formatted}</strong>
                </label>
              ))
            )}
          </fieldset>
        ))
      )}
      <div className="checkout-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={onRequote}
          disabled={loading}
          loading={loading}
        >
          Atualizar frete
        </Button>
        <Button
          type="button"
          onClick={onReview}
          disabled={loading || !complete}
        >
          Revisar pedido
        </Button>
      </div>
    </div>
  );
}

function Review({
  checkout,
  loading,
  onReady,
  onEditAddress,
}: {
  checkout: PublicCheckoutDTO;
  loading: boolean;
  onReady: () => void;
  onEditAddress: () => void;
}) {
  return (
    <div>
      <StepTitle
        number="04"
        title="Revise seu pedido"
        text="Confira seus dados antes da futura etapa de pagamento."
      />
      <section className="review-block">
        <div>
          <h3>Contato</h3>
          <p>
            {checkout.customer?.name}
            <br />
            {checkout.customer?.email}
            <br />
            {checkout.customer?.phone}
          </p>
        </div>
        <div>
          <h3>Entrega</h3>
          <p>
            {checkout.address?.street}, {checkout.address?.number}
            <br />
            {checkout.address?.neighborhood} · {checkout.address?.city}/
            {checkout.address?.state}
            <br />
            CEP {checkout.address?.postalCodeFormatted}
          </p>
          <button type="button" className="text-link" onClick={onEditAddress}>
            Alterar endereço
          </button>
        </div>
      </section>
      <Alert tone="info">
        {checkout.totals?.taxes.known
          ? `${checkout.totals.taxes.label}. Nenhum imposto adicional foi inventado.`
          : "Tributos ainda não determinados não são apresentados como R$ 0. O pagamento permanece bloqueado."}
      </Alert>
      <Button
        type="button"
        loading={loading}
        disabled={loading || !checkout.readiness.ready}
        onClick={onReady}
      >
        Continuar para pagamento
      </Button>
      <p className="checkout-honesty">
        Nenhum pagamento será processado agora.
      </p>
    </div>
  );
}

function Ready({ checkout }: { checkout: PublicCheckoutDTO }) {
  return (
    <div className="ready-panel">
      <span aria-hidden="true">✓</span>
      <h2 id="checkout-step-heading" tabIndex={-1}>
        Checkout pronto
      </h2>
      <p>Escolha Pix ou cartão no ambiente de pagamento configurado.</p>
      <code>{checkout.id}</code>
      <Link className="button" href="/checkout/pagamento">
        Ir para pagamento
      </Link>
    </div>
  );
}

function OrderSummary({ checkout }: { checkout: PublicCheckoutDTO }) {
  const totals = checkout.totals;
  return (
    <aside className="checkout-summary">
      <p className="eyebrow">Resumo</p>
      <h2>Seu pedido</h2>
      {checkout.cart.items.map((item) => (
        <div className="summary-item" key={item.id}>
          <span>
            {item.quantity}× {item.productTitle}
            <small>{item.variantTitle}</small>
          </span>
          <strong>{item.total.formatted}</strong>
        </div>
      ))}
      <div className="summary-totals">
        <p>
          <span>Produtos</span>
          <strong>
            {(totals?.products ?? checkout.cart.subtotal).formatted}
          </strong>
        </p>
        <p>
          <span>Entrega</span>
          <strong>{totals?.shipping.formatted ?? "A calcular"}</strong>
        </p>
        <p>
          <span>Tributos conhecidos</span>
          <strong>
            {totals?.taxes.amount?.formatted ??
              totals?.taxes.label ??
              "Não determinado"}
          </strong>
        </p>
        <p className="summary-total">
          <span>Total atual</span>
          <strong>
            {totals?.total.formatted ?? checkout.cart.subtotal.formatted}
          </strong>
        </p>
      </div>
    </aside>
  );
}

function StepTitle({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <header className="checkout-step-title">
      <span>{number}</span>
      <div>
        <h2 id="checkout-step-heading" tabIndex={-1}>
          {title}
        </h2>
        <p>{text}</p>
      </div>
    </header>
  );
}

function stepFor(checkout: PublicCheckoutDTO): Step {
  if (!checkout.customer) return "contact";
  if (!checkout.address) return "address";
  if (checkout.status === "REVIEW" || checkout.status === "READY_FOR_PAYMENT")
    return "review";
  return "shipping";
}

async function requestCheckout(
  url: string,
  init?: RequestInit,
): Promise<PublicCheckoutDTO> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      isObject(payload) && typeof payload.message === "string"
        ? payload.message
        : "Não foi possível atualizar o checkout",
    );
  if (
    !isObject(payload) ||
    !isObject(payload.checkout) ||
    typeof payload.checkout.id !== "string"
  )
    throw new Error("Resposta de checkout inválida");
  return payload.checkout as PublicCheckoutDTO;
}

function messageOf(value: unknown): string {
  return value instanceof Error
    ? value.message
    : "Não foi possível atualizar o checkout";
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
