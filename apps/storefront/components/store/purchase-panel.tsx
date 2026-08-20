"use client";

import type { PublicVariantDTO } from "@achilles/domain";
import { useState } from "react";
import { useCart } from "../cart/cart-provider";
import { QuantitySelector } from "../ui/interactive";
import { Button, Price } from "../ui/primitives";

export function PurchasePanel({ variants }: { variants: PublicVariantDTO[] }) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const { addItem, loading } = useCart();
  const selected = variants.find((variant) => variant.id === selectedId);
  const purchasable = Boolean(selected?.available);

  return (
    <div className="purchase-panel">
      {selected && (
        <Price value={selected.price.formatted} unavailable={!purchasable} />
      )}
      <fieldset className="variant-field">
        <legend>Escolha uma variante</legend>
        <div className="variant-options">
          {variants.map((variant) => (
            <button
              key={variant.id}
              className={`variant-option ${selectedId === variant.id ? "is-selected" : ""}`}
              aria-pressed={selectedId === variant.id}
              disabled={!variant.available}
              onClick={() => {
                setSelectedId(variant.id);
                setMessage(null);
              }}
            >
              {variant.options.map((option) => option.value).join(" · ") ||
                variant.title}
              {!variant.available && " — indisponível"}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="purchase-row">
        <QuantitySelector
          disabled={!purchasable || loading}
          value={quantity}
          onChange={setQuantity}
        />
        <Button
          loading={loading}
          disabled={!purchasable || loading}
          onClick={() => {
            if (!selected) return;
            setMessage(null);
            void addItem(selected.id, quantity)
              .then(() => {
                setMessage("Produto adicionado à mochila.");
              })
              .catch((error: unknown) => {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível adicionar o produto.",
                );
              });
          }}
        >
          {purchasable ? "Adicionar à mochila" : "Indisponível"}
        </Button>
      </div>
      {message && (
        <p className="commercial-note" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
