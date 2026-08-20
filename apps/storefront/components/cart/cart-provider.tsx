"use client";

import type { PublicCartDTO } from "@achilles/domain";
import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Drawer } from "../ui/interactive";
import { IconButton } from "../ui/primitives";
import { MinusIcon, PlusIcon } from "../ui/icons";
import { ShippingCalculator } from "../store/shipping-calculator";

const storageKey = "achilles_cart_id";

type CartContextValue = {
  cart: PublicCartDTO | null;
  loading: boolean;
  error: string | null;
  openCart: () => void;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<PublicCartDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cartId = window.localStorage.getItem(storageKey);
    if (!cartId) return;
    requestCart(`/api/cart?id=${encodeURIComponent(cartId)}`)
      .then(setCart)
      .catch(() => {
        window.localStorage.removeItem(storageKey);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const ensureCart = useCallback(async (): Promise<PublicCartDTO> => {
    if (cart) return cart;
    const created = await requestCart("/api/cart", { method: "POST" });
    window.localStorage.setItem(storageKey, created.id);
    setCart(created);
    return created;
  }, [cart]);

  const run = useCallback(async (operation: () => Promise<PublicCartDTO>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await operation();
      setCart(updated);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível atualizar o carrinho",
      );
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      error,
      openCart: () => {
        setDrawerOpen(true);
      },
      addItem: async (variantId, quantity) => {
        await run(async () => {
          const current = await ensureCart();
          const updated = await requestCart("/api/cart/items", {
            method: "POST",
            body: JSON.stringify({ cartId: current.id, variantId, quantity }),
          });
          setDrawerOpen(true);
          return updated;
        });
      },
      updateItem: async (itemId, quantity) => {
        if (!cart) return;
        await run(() =>
          requestCart(`/api/cart/items/${encodeURIComponent(itemId)}`, {
            method: "POST",
            body: JSON.stringify({ cartId: cart.id, quantity }),
          }),
        );
      },
      removeItem: async (itemId) => {
        if (!cart) return;
        await run(() =>
          requestCart(
            `/api/cart/items/${encodeURIComponent(itemId)}?cartId=${encodeURIComponent(cart.id)}`,
            { method: "DELETE" },
          ),
        );
      },
    }),
    [cart, ensureCart, error, loading, run],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        title="Sua mochila"
        closeLabel="Fechar carrinho"
      >
        <CartContents value={value} />
      </Drawer>
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart deve ser usado dentro de CartProvider");
  return value;
}

function CartContents({ value }: { value: CartContextValue }) {
  const { cart, loading, error, updateItem, removeItem } = value;
  if (!cart || cart.items.length === 0)
    return (
      <div className="cart-empty">
        <strong>Sua mochila está vazia.</strong>
        <p>Explore o catálogo e adicione um equipamento para continuar.</p>
        <Link href="/#destaques" className="button button--primary">
          Explorar produtos
        </Link>
      </div>
    );
  return (
    <div className="cart-panel" aria-busy={loading}>
      <div className="cart-items">
        {cart.items.map((item) => (
          <article className="cart-item" key={item.id}>
            <Image
              src={
                item.thumbnail?.startsWith("/")
                  ? item.thumbnail
                  : "/images/product-placeholder.svg"
              }
              alt=""
              width={92}
              height={112}
            />
            <div>
              <Link href={`/produto/${item.productSlug}`}>
                <strong>{item.productTitle}</strong>
              </Link>
              <small>{item.variantTitle}</small>
              <span>{item.unitPrice.formatted}</span>
              <div className="cart-item__actions">
                <div
                  className="quantity quantity--compact"
                  aria-label="Quantidade"
                >
                  <IconButton
                    label="Diminuir quantidade"
                    disabled={loading || item.quantity === 1}
                    onClick={() => {
                      void updateItem(item.id, item.quantity - 1).catch(
                        () => undefined,
                      );
                    }}
                  >
                    <MinusIcon />
                  </IconButton>
                  <output aria-live="polite">{item.quantity}</output>
                  <IconButton
                    label="Aumentar quantidade"
                    disabled={loading}
                    onClick={() => {
                      void updateItem(item.id, item.quantity + 1).catch(
                        () => undefined,
                      );
                    }}
                  >
                    <PlusIcon />
                  </IconButton>
                </div>
                <button
                  className="cart-remove"
                  disabled={loading}
                  onClick={() => {
                    void removeItem(item.id).catch(() => undefined);
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <ShippingCalculator
        key={`${cart.id}:${String(cart.itemCount)}:${String(cart.subtotal.amount)}`}
        cartId={cart.id}
        compact
      />
      <div className="cart-summary">
        <span>Subtotal</span>
        <strong>{cart.subtotal.formatted}</strong>
        <small>Frete e prazo serão calculados na próxima etapa.</small>
        <button className="button button--primary" disabled>
          Entrega na próxima etapa
        </button>
      </div>
    </div>
  );
}

async function requestCart(
  url: string,
  init?: RequestInit,
): Promise<PublicCartDTO> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      isObject(payload) && typeof payload.message === "string"
        ? payload.message
        : "Não foi possível atualizar o carrinho";
    throw new Error(message);
  }
  if (!isObject(payload) || !isObject(payload.cart))
    throw new Error("Resposta de carrinho inválida");
  return payload.cart as PublicCartDTO;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
