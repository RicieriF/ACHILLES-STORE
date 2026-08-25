"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Shell, Loading, ErrorState, money } from "../../components/shell";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";
const human = (p: Product) =>
  p.archived
    ? "ARQUIVADO"
    : p.status === "published"
      ? "NA VITRINE"
      : p.attention.length
        ? "PRECISA COMPLETAR"
        : "RASCUNHO";
export default function Showcase() {
  const [items, setItems] = useState<Product[]>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState<string>();
  const load = useCallback(
    () =>
      api<{ products: Product[] }>(
        `admin/achilles/operations/catalog?limit=48&filter=${filter}`,
      )
        .then((x) => {
          setItems(Array.isArray(x.products) ? x.products : []);
          setError("");
        })
        .catch((e) => setError(e.message)),
    [filter],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function action(
    id: string,
    kind: "archive" | "publish" | "pause" | "delete",
  ) {
    if (busy) return;
    if (
      ["archive", "delete"].includes(kind) &&
      !window.confirm(
        kind === "delete"
          ? "Excluir permanentemente este rascunho quando for seguro?"
          : "Arquivar este produto e retirá-lo da vitrine?",
      )
    )
      return;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      if (kind === "pause") {
        await api(`admin/achilles/operations/products/${id}`, {
          method: "POST",
          body: JSON.stringify({ status: "draft" }),
        });
      } else if (kind === "delete") {
        await api(`admin/achilles/operations/products/${id}`, {
          method: "DELETE",
        });
      } else {
        await api(`admin/achilles/operations/products/${id}/${kind}`, {
          method: "POST",
          body: "{}",
        });
      }
      await load();
      setMessage(
        kind === "publish"
          ? "Produto publicado na vitrine."
          : kind === "pause"
            ? "Produto pausado."
            : kind === "archive"
              ? "Produto arquivado."
              : "Produto excluído.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar o produto.",
      );
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <Shell
      title="Minha Vitrine"
      action={
        <Link href="/adicionar" className="button">
          + ADICIONAR PRODUTO
        </Link>
      }
    >
      <div className="toolbar">
        <button
          className={filter === "ALL" ? "" : "secondary"}
          onClick={() => setFilter("ALL")}
        >
          ATIVOS
        </button>
        <button
          className={filter === "ARCHIVED" ? "" : "secondary"}
          onClick={() => setFilter("ARCHIVED")}
        >
          ARQUIVADOS
        </button>
      </div>
      {error && <ErrorState message={error} />}{" "}
      {message && <div className="message">{message}</div>}
      {!items ? (
        <Loading />
      ) : (
        <div className="products">
          {items.map((p) => (
            <article className="product-card" key={p.id}>
              <div className="product-image">
                {p.thumbnail ? (
                  <Image
                    src={p.thumbnail}
                    alt=""
                    fill
                    unoptimized
                    loader={({ src }) => src}
                  />
                ) : (
                  "Sem foto"
                )}
              </div>
              <div className="product-body">
                <span
                  className={`badge ${p.status === "published" ? "good" : p.attention.length ? "warn" : ""}`}
                >
                  {human(p)}
                </span>
                <h2>{p.title}</h2>
                <strong>{money(p.retailPrice)}</strong>
                <p className="muted">
                  {p.supplier || "Fornecedor não vinculado"}
                </p>
                {!p.canPublish && p.publicationBlockers.length > 0 && (
                  <div className="publication-checklist">
                    <strong>ANTES DE PUBLICAR:</strong>
                    <ul>
                      {p.publicationBlockers.map((blocker) => (
                        <li key={blocker}>✗ {blocker}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="product-actions">
                  <Link
                    className="button secondary"
                    href={`/adicionar?editar=${p.id}`}
                  >
                    EDITAR
                  </Link>
                  {!p.archived && p.status !== "published" && p.canPublish && (
                    <button
                      disabled={Boolean(busy)}
                      onClick={() => void action(p.id, "publish")}
                    >
                      ATIVAR
                    </button>
                  )}
                  {!p.archived && p.status === "published" && (
                    <button
                      disabled={Boolean(busy)}
                      className="secondary"
                      onClick={() => void action(p.id, "pause")}
                    >
                      PAUSAR
                    </button>
                  )}
                  {!p.archived && (
                    <button
                      disabled={Boolean(busy)}
                      className="danger"
                      onClick={() => void action(p.id, "archive")}
                    >
                      ARQUIVAR
                    </button>
                  )}
                  {!p.archived && p.status !== "published" && (
                    <button
                      disabled={Boolean(busy)}
                      className="danger"
                      onClick={() => void action(p.id, "delete")}
                    >
                      EXCLUIR
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="state">Nenhum produto nesta lista.</div>
          )}
        </div>
      )}
    </Shell>
  );
}
