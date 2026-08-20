"use client";

import type { PublicShippingQuoteDTO } from "@achilles/domain";
import { useState } from "react";
import { Button, Input } from "../ui/primitives";

export function ShippingCalculator({
  variantId,
  quantity = 1,
  cartId,
  compact = false,
}: {
  variantId?: string | undefined;
  quantity?: number | undefined;
  cartId?: string | undefined;
  compact?: boolean | undefined;
}) {
  const [postalCode, setPostalCode] = useState("");
  const [quote, setQuote] = useState<PublicShippingQuoteDTO | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async (submittedPostalCode: string) => {
    setLoading(true);
    setError(null);
    setQuote(null);
    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(cartId ? { cartId } : { variantId, quantity }),
          postalCode: submittedPostalCode,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok || !isObject(payload) || !isObject(payload.quote))
        throw new Error(
          isObject(payload) && typeof payload.message === "string"
            ? payload.message
            : "Não foi possível calcular a entrega",
        );
      const publicQuote = payload.quote as PublicShippingQuoteDTO;
      setQuote(publicQuote);
      setSelected(publicQuote.methods[0]?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível calcular a entrega",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={`shipping-calculator ${compact ? "shipping-calculator--compact" : ""}`}
      aria-labelledby={
        cartId ? "cart-shipping-title" : "product-shipping-title"
      }
    >
      <div>
        <strong id={cartId ? "cart-shipping-title" : "product-shipping-title"}>
          Calcular entrega
        </strong>
        <p>
          Informe apenas o CEP. O endereço completo será solicitado no checkout.
        </p>
      </div>
      <form
        className="shipping-calculator__form"
        onSubmit={(event) => {
          event.preventDefault();
          const submittedPostalCode = String(
            new FormData(event.currentTarget).get("postalCode") ?? "",
          );
          void calculate(submittedPostalCode);
        }}
      >
        <Input
          id={cartId ? "cart-postal-code" : "product-postal-code"}
          label="CEP"
          name="postalCode"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          value={postalCode}
          onChange={(event) => {
            setPostalCode(event.target.value);
          }}
        />
        <Button
          type="submit"
          loading={loading}
          disabled={loading || (!variantId && !cartId)}
        >
          CALCULAR
        </Button>
      </form>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      {quote?.message && (
        <p className="commercial-note" role="status">
          {quote.message}
        </p>
      )}
      {quote && quote.methods.length > 0 && (
        <fieldset className="shipping-methods">
          <legend>Opções de entrega</legend>
          {quote.methods.map((method) => (
            <label key={method.id} className="shipping-method">
              <input
                type="radio"
                name={
                  cartId ? "cart-shipping-method" : "product-shipping-method"
                }
                value={method.id}
                checked={selected === method.id}
                onChange={() => {
                  setSelected(method.id);
                }}
              />
              <span>
                <strong>{method.name}</strong>
                <small>
                  {method.estimatedMinimumDays}–{method.estimatedMaximumDays}{" "}
                  dias estimados
                </small>
                <small>
                  {method.trackingSupported
                    ? "Com rastreamento"
                    : "Rastreamento não confirmado"}
                </small>
                <small>{method.dutiesNotice}</small>
              </span>
              <strong>{method.price.formatted}</strong>
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
