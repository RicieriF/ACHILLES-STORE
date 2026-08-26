"use client";
import { FormEvent, useEffect, useState } from "react";
import { Shell, Loading, ErrorState, money } from "../../components/shell";
import { api } from "../../lib/api";
import type { Order } from "../../lib/types";
const status: Record<string, string> = {
  PAYMENT_PENDING: "NOVO",
  PAID: "PAGO",
  FULFILLMENT_REVIEW: "AGUARDANDO FORNECEDOR",
  SUPPLIER_APPROVAL_REQUIRED: "AGUARDANDO FORNECEDOR",
  SUPPLIER_APPROVED: "PEDIDO AO FORNECEDOR",
  ORDERING_SUPPLIER: "PEDIDO AO FORNECEDOR",
  SUPPLIER_CONFIRMED: "PEDIDO AO FORNECEDOR",
  IN_FULFILLMENT: "PEDIDO AO FORNECEDOR",
  SHIPPED: "ENVIADO",
  DELIVERED: "CONCLUÍDO",
  EXCEPTION: "PRECISA DE ATENÇÃO",
  CANCELLED: "CANCELADO",
};
export default function Orders() {
  const [orders, setOrders] = useState<Order[]>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Order>();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");
  const load = () =>
    api<{ orders: Order[] }>("admin/achilles/orders")
      .then((r) => setOrders(Array.isArray(r.orders) ? r.orders : []))
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  async function tracking(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    if (busy) return;
    setBusy(selected.id);
    setError("");
    setMessage("");
    const d = new FormData(e.currentTarget);
    try {
      await api(`admin/achilles/orders/${selected.id}/tracking`, {
        method: "POST",
        body: JSON.stringify({
          carrier: d.get("carrier"),
          tracking_number: d.get("number"),
          tracking_url: d.get("url") || null,
        }),
      });
      setSelected(undefined);
      await load();
      setMessage("Rastreio salvo. O pedido foi atualizado.");
    } catch (x) {
      setError(
        x instanceof Error
          ? x.message
          : "Não foi possível registrar o rastreio.",
      );
    } finally {
      setBusy(undefined);
    }
  }
  async function approve(order: Order) {
    if (
      !window.confirm(
        `Aprovar o pedido ${order.reference} para preparação pelo fornecedor?`,
      )
    )
      return;
    if (busy) return;
    setBusy(order.id);
    setError("");
    setMessage("");
    try {
      await api(`admin/achilles/orders/${order.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      });
      await load();
      setMessage("Pedido aprovado para preparação pelo fornecedor.");
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Não foi possível aprovar o pedido.",
      );
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <Shell title="Pedidos">
      {error && <ErrorState message={error} />}{" "}
      {message && <div className="message">{message}</div>}
      {!orders ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NÚMERO</th>
                <th>CLIENTE</th>
                <th>PRODUTO</th>
                <th>TOTAL</th>
                <th>STATUS</th>
                <th>PRÓXIMO PASSO</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.reference}</td>
                  <td>{o.customer?.name || o.customer?.email || "Cliente"}</td>
                  <td>{o.items?.[0]?.title || "Pedido"}</td>
                  <td>{money(o.total)}</td>
                  <td>
                    <span className="badge">
                      {status[o.status] || o.status}
                    </span>
                  </td>
                  <td>
                    {o.status === "SUPPLIER_APPROVAL_REQUIRED" && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => void approve(o)}
                      >
                        APROVAR
                      </button>
                    )}{" "}
                    <button
                      className="secondary"
                      disabled={Boolean(busy)}
                      onClick={() => setSelected(o)}
                    >
                      REGISTRAR RASTREIO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="state">Nenhum pedido recebido.</div>
          )}
        </div>
      )}
      {selected && (
        <form className="card" style={{ marginTop: 20 }} onSubmit={tracking}>
          <h2>Registrar rastreio · {selected.reference}</h2>
          <div className="grid">
            <div className="field">
              <label htmlFor="tracking-carrier">Transportadora</label>
              <input id="tracking-carrier" name="carrier" required />
            </div>
            <div className="field">
              <label htmlFor="tracking-number">Código</label>
              <input
                id="tracking-number"
                name="number"
                minLength={4}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tracking-url">Link</label>
              <input id="tracking-url" name="url" type="url" />
            </div>
          </div>
          <button disabled={Boolean(busy)}>
            {busy ? "SALVANDO..." : "SALVAR RASTREIO"}
          </button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setSelected(undefined)}
          >
            CANCELAR
          </button>
        </form>
      )}
    </Shell>
  );
}
