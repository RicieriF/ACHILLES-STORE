"use client";
import { useEffect, useState } from "react";
import { Shell, Loading, ErrorState, money } from "../../components/shell";
import { api } from "../../lib/api";
type Customer = {
  id: string;
  name: string | null;
  email: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};
export default function Customers() {
  const [data, setData] = useState<Customer[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ customers: Customer[] }>("admin/achilles/operations/customers")
      .then((r) => setData(Array.isArray(r.customers) ? r.customers : []))
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
                  <td>{c.name || "Não informado"}</td>
                  <td>{c.email}</td>
                  <td>{c.orderCount}</td>
                  <td>{money(c.totalSpent)}</td>
                  <td>
                    {c.lastOrderAt
                      ? new Date(c.lastOrderAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="state">Nenhum cliente encontrado.</div>
          )}
        </div>
      )}
    </Shell>
  );
}
