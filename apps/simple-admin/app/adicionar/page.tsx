"use client";
import { FormEvent, useState } from "react";
import Image from "next/image";
import { Shell, ErrorState } from "../../components/shell";
import { api } from "../../lib/api";
type Mode = "choose" | "search" | "link" | "manual";
export default function AddProduct() {
  const [mode, setMode] = useState<Mode>("choose");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string>();
  async function manual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      const r = await api<{ product: { id: string } }>(
        "admin/achilles/operations/products",
        {
          method: "POST",
          body: JSON.stringify({
            title: d.get("title"),
            description: d.get("description") || null,
            image_urls: d.get("image") ? [d.get("image")] : [],
            price_brl: d.get("price") ? Number(d.get("price")) : null,
            supplier_id: null,
            supplier_product_id: null,
            source_url: null,
            supplier_cost: null,
            sku: null,
            fulfillment_mode: "GENERIC_DROPSHIP",
            availability: "UNKNOWN",
            variants: [],
          }),
        },
      );
      setCreated(r.product.id);
      setMessage("Rascunho criado. Complete os dados antes de publicar.");
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Não foi possível salvar o rascunho.",
      );
    }
  }
  async function link(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await api("admin/achilles/imports", {
        method: "POST",
        body: JSON.stringify({ source_url: d.get("url") }),
      });
      setMessage(
        "Link recebido. Criamos uma análise assistida, sem fingir automação do fornecedor.",
      );
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Não foi possível analisar o link.",
      );
    }
  }
  return (
    <Shell title="Adicionar Produto">
      {error && <ErrorState message={error} />}{" "}
      {message && (
        <div className="message">
          {message}
          {created && (
            <>
              {" "}
              <a href={`/vitrine?produto=${created}`}>Abrir na vitrine</a>
            </>
          )}
        </div>
      )}
      {mode === "choose" && (
        <>
          <h2>Como você quer adicionar?</h2>
          <div className="grid">
            <button className="choice" onClick={() => setMode("search")}>
              <strong>BUSCAR PRODUTO</strong>
              <span>CJdropshipping</span>
            </button>
            <button className="choice" onClick={() => setMode("link")}>
              <strong>COLAR LINK</strong>
              <span>Alibaba, AliExpress ou outro</span>
            </button>
            <button className="choice" onClick={() => setMode("manual")}>
              <strong>CADASTRAR MANUALMENTE</strong>
              <span>Comece só com o nome</span>
            </button>
          </div>
        </>
      )}
      {mode === "search" && <Search onBack={() => setMode("choose")} />}{" "}
      {mode === "link" && (
        <form className="card" onSubmit={link}>
          <h2>Colar link do fornecedor</h2>
          <div className="field">
            <label htmlFor="url">Link do produto</label>
            <input id="url" name="url" type="url" required />
          </div>
          <button>CRIAR RASCUNHO ASSISTIDO</button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setMode("choose")}
          >
            VOLTAR
          </button>
        </form>
      )}
      {mode === "manual" && (
        <form className="card" onSubmit={manual}>
          <h2>Ficha simples</h2>
          <div className="field">
            <label htmlFor="title">Nome *</label>
            <input id="title" name="title" required />
          </div>
          <div className="field">
            <label htmlFor="image">Foto principal (URL)</label>
            <input id="image" name="image" type="url" />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" name="description" />
          </div>
          <div className="field">
            <label htmlFor="price">Preço na minha loja (R$)</label>
            <input id="price" name="price" type="number" min="0" step="0.01" />
          </div>
          <button>SALVAR RASCUNHO</button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setMode("choose")}
          >
            VOLTAR
          </button>
        </form>
      )}
    </Shell>
  );
}
function Search({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    Array<{
      id: string;
      title: string;
      image: string | null;
      priceMin: string | null;
      currency: string | null;
    }>
  >([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string>();
  async function search(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ items: typeof results }>(
        `admin/achilles/integrations/cj/products?keyword=${encodeURIComponent(q)}`,
      );
      setResults(r.items ?? []);
    } catch (x) {
      setError(
        x instanceof Error
          ? x.message
          : "A busca CJ não está disponível agora.",
      );
    }
  }
  async function importProduct(product: (typeof results)[number]) {
    setBusy(product.id);
    setError("");
    setMessage("");
    try {
      const [detail, variantResult] = await Promise.all([
        api<{
          product: typeof product & {
            description?: string | null;
            images?: string[];
            price?: string | null;
          };
        }>(`admin/achilles/integrations/cj/products/${product.id}`),
        api<{
          variants: Array<{ id: string; sku: string; title: string }>;
        }>(
          `admin/achilles/integrations/cj/variants?pid=${encodeURIComponent(product.id)}`,
        ),
      ]);
      if (!variantResult.variants.length) {
        throw new Error(
          "Este produto não possui uma variação disponível para importar.",
        );
      }
      await api("admin/achilles/integrations/cj/import", {
        method: "POST",
        body: JSON.stringify({
          pid: product.id,
          title: detail.product.title,
          description: detail.product.description ?? "",
          images:
            detail.product.images ??
            (detail.product.image ? [detail.product.image] : []),
          sourceUrl: `https://cjdropshipping.com/product/${product.id}`,
          currency: detail.product.currency ?? "USD",
          sourceCost: detail.product.price ?? detail.product.priceMin ?? "0",
          variants: variantResult.variants.map((variant) => ({
            vid: variant.id,
            sku: variant.sku,
            title: variant.title,
          })),
        }),
      });
      setMessage(
        "Rascunho CJ criado. Defina o preço antes de colocar na vitrine.",
      );
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Não foi possível importar o produto.",
      );
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <div>
      <form className="toolbar" onSubmit={search}>
        <input
          aria-label="Buscar no CJ"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="O que você procura?"
        />
        <button>BUSCAR</button>
        <button type="button" className="secondary" onClick={onBack}>
          VOLTAR
        </button>
      </form>
      {error && <ErrorState message={error} />}
      {message && (
        <div className="message">
          {message} <a href="/vitrine">Abrir Minha Vitrine</a>
        </div>
      )}
      <div className="products">
        {results.map((p) => (
          <article className="product-card" key={p.id}>
            <div className="product-image">
              {p.image ? (
                <Image
                  src={p.image}
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
              <h2>{p.title}</h2>
              <p>Selecione para importar como rascunho.</p>
              <button
                disabled={Boolean(busy)}
                onClick={() => void importProduct(p)}
              >
                {busy === p.id ? "IMPORTANDO..." : "IMPORTAR COMO RASCUNHO"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
