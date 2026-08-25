"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell, Loading, ErrorState, money } from "../../components/shell";
import { api } from "../../lib/api";
import type { Dashboard } from "../../lib/types";
export default function Home() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Dashboard>("admin/achilles/operations/dashboard")
      .then(setData)
      .catch((e) => setError(String(e.message)));
  }, []);
  return (
    <Shell
      title="Início"
      action={
        <Link className="button" href="/adicionar">
          + ADICIONAR PRODUTO
        </Link>
      }
    >
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <section className="grid">
            <div className="card metric">
              Produtos na vitrine<strong>{data.catalog.published}</strong>
            </div>
            <div className="card metric">
              Rascunhos<strong>{data.catalog.drafts}</strong>
            </div>
            <div className="card metric">
              Pedidos novos<strong>{data.today.orders}</strong>
            </div>
            <div className="card metric">
              Vendas<strong>{money(data.today.sales)}</strong>
            </div>
          </section>
          <section className="card" style={{ marginTop: 20 }}>
            <h2>Precisam de atenção</h2>
            <p className="muted">Cada produto aparece uma única vez.</p>
            <div className="attention-list">
              {Array.from(
                new Map(data.alerts.map((a) => [a.productId, a])).values(),
              ).map((a) => (
                <div className="attention" key={a.productId}>
                  <div>
                    <strong>{a.product}</strong>
                    <div className="muted">
                      Complete as informações antes de publicar.
                    </div>
                  </div>
                  <Link
                    className="button secondary"
                    href={`/vitrine?produto=${a.productId}`}
                  >
                    COMPLETAR
                  </Link>
                </div>
              ))}
              {data.alerts.length === 0 && <p>Tudo em ordem por aqui.</p>}
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}
