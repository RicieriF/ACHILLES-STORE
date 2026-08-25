"use client";
import { useEffect, useState } from "react";
import { Shell, Loading, ErrorState, money } from "../../components/shell";
import { api } from "../../lib/api";
type Customer = {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  metadata?: {
    order_count?: number;
    total_spent?: number;
    last_order_at?: string;
  };
};
export default function Customers() {
  const [data, setData] = useState<Customer[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ customers: Customer[] }>("admin/customers?limit=100")
      .then((r) => setData(r.customers))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Shell title="Clientes">
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NOME</th>
                <th>E-MAIL</th>
                <th>PEDIDOS</th>
                <th>TOTAL GASTO</th>
                <th>ÚLTIMO PEDIDO</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      "Não informado"}
                  </td>
                  <td>{c.email}</td>
                  <td>{c.metadata?.order_count ?? "—"}</td>
                  <td>{money(c.metadata?.total_spent)}</td>
                  <td>
                    {c.metadata?.last_order_at
                      ? new Date(c.metadata.last_order_at).toLocaleDateString(
                          "pt-BR",
                        )
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
