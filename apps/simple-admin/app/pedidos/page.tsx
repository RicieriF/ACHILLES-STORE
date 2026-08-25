"use client";
import { FormEvent, useEffect, useState } from "react";
import { Shell, Loading, ErrorState, money } from "../../components/shell";
import { api } from "../../lib/api";
import type { Order } from "../../lib/types";
const status: Record<string, string> = {
  PAID: "PAGAMENTO RECEBIDO",
  APPROVAL_REQUIRED: "AGUARDANDO FORNECEDOR",
  APPROVED: "PEDIDO AO FORNECEDOR",
  SHIPPED: "ENVIADO",
  DELIVERED: "ENTREGUE",
};
export default function Orders() {
  const [orders, setOrders] = useState<Order[]>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Order>();
  const load = () =>
    api<{ orders: Order[] }>("admin/achilles/orders")
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  async function tracking(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
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
      load();
    } catch (x) {
      setError(
        x instanceof Error
          ? x.message
          : "Não foi possível registrar o rastreio.",
      );
    }
  }
  async function approve(order: Order) {
    if (
      !window.confirm(
        `Aprovar o pedido ${order.reference} para preparação pelo fornecedor?`,
      )
    )
      return;
    try {
      await api(`admin/achilles/orders/${order.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      });
      await load();
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Não foi possível aprovar o pedido.",
      );
    }
  }
  return (
    <Shell title="Pedidos">
      {error && <ErrorState message={error} />}{" "}
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
                    {o.status === "APPROVAL_REQUIRED" && (
                      <button onClick={() => void approve(o)}>APROVAR</button>
                    )}{" "}
                    <button
                      className="secondary"
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
              <label>Transportadora</label>
              <input name="carrier" required />
            </div>
            <div className="field">
              <label>Código</label>
              <input name="number" minLength={4} required />
            </div>
            <div className="field">
              <label>Link</label>
              <input name="url" type="url" />
            </div>
          </div>
          <button>SALVAR RASTREIO</button>{" "}
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
