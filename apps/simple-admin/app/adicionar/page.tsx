"use client";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Shell, ErrorState } from "../../components/shell";
import { ApiError, api, LONG_API_TIMEOUT_MS } from "../../lib/api";
import type { Product, SupplierIntegration } from "../../lib/types";
type Mode = "choose" | "search" | "link" | "manual";
export default function AddProduct() {
  return (
    <Suspense
      fallback={
        <Shell title="Adicionar Produto">
          <div className="state">Carregando...</div>
        </Shell>
      }
    >
      <AddProductContent />
    </Suspense>
  );
}

function AddProductContent() {
  const editId = useSearchParams().get("editar") ?? undefined;
  const [mode, setMode] = useState<Mode>("choose");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string>();
  const [formBusy, setFormBusy] = useState(false);
  const [integrations, setIntegrations] = useState<SupplierIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [integrationsError, setIntegrationsError] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ integrations: SupplierIntegration[] }>(
      "admin/achilles/integrations",
    )
      .then((result) => {
        if (active) {
          setIntegrations(result.integrations);
          setIntegrationsError(false);
        }
      })
      .catch(() => {
        if (active) {
          setIntegrations([]);
          setIntegrationsError(true);
        }
      })
      .finally(() => {
        if (active) setIntegrationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  if (editId) return <EditProduct productId={editId} />;
  const supplier = (id: string) =>
    integrations.find((integration) => integration.id === id);
  const cj = supplier("cj");
  const cjAvailable = cj?.status === "CONNECTED" || cj?.status === "CONFIGURED";
  async function manual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formBusy) return;
    setFormBusy(true);
    setError("");
    setMessage("");
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
    } finally {
      setFormBusy(false);
    }
  }
  async function link(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formBusy) return;
    setFormBusy(true);
    setError("");
    setMessage("");
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
    } finally {
      setFormBusy(false);
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
          {integrationsLoading && (
            <div className="state">Verificando fornecedores...</div>
          )}
          {integrationsError && (
            <ErrorState message="Não foi possível verificar os fornecedores. Atualize a página ou confirme se o Commerce está iniciado." />
          )}
          <div className="grid">
            {cjAvailable && (
              <button className="choice" onClick={() => setMode("search")}>
                <strong>BUSCAR NO CJ</strong>
                <span>
                  CJdropshipping ·{" "}
                  {cj?.status === "CONNECTED" ? "CONECTADO" : "CONFIGURADO"}
                </span>
              </button>
            )}
            {!integrationsLoading && !cjAvailable && (
              <div className="choice" role="status">
                <strong>CJdropshipping</strong>
                <span>
                  {cj?.status === "ERROR"
                    ? "ERRO DE CONEXÃO · abra Configurações"
                    : cj?.status === "DISABLED"
                      ? "DESATIVADO"
                      : "PRECISA CONFIGURAR"}
                </span>
              </div>
            )}
            <div className="choice" role="status">
              <strong>Alibaba</strong>
              <span>
                {supplier("alibaba")?.status === "CONNECTED"
                  ? "CONECTADO"
                  : "PRECISA CONFIGURAR · use COLAR LINK"}
              </span>
            </div>
            <div className="choice" role="status">
              <strong>AliExpress</strong>
              <span>PRECISA CONFIGURAR · use COLAR LINK</span>
            </div>
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
          <button disabled={formBusy}>
            {formBusy ? "ANALISANDO..." : "CRIAR RASCUNHO ASSISTIDO"}
          </button>{" "}
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
          <button disabled={formBusy}>
            {formBusy ? "SALVANDO..." : "SALVAR RASCUNHO"}
          </button>{" "}
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

function EditProduct({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ product: Product }>(`admin/achilles/operations/catalog/${productId}`)
      .then((result) => setProduct(result.product))
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível abrir o produto.",
        ),
      );
  }, [productId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`admin/achilles/operations/products/${productId}`, {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description") || undefined,
          image_urls: data.get("image") ? [data.get("image")] : [],
          price_brl: data.get("price") ? Number(data.get("price")) : null,
          sku: data.get("sku") || undefined,
          availability: data.get("availability") || undefined,
        }),
      });
      const refreshed = await api<{ product: Product }>(
        `admin/achilles/operations/catalog/${productId}`,
      );
      setProduct(refreshed.product);
      setMessage("Produto salvo. As informações foram atualizadas.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Editar Produto">
      {error && <ErrorState message={error} />}
      {message && <div className="message">{message}</div>}
      {!product ? (
        !error && <div className="state">Carregando produto...</div>
      ) : (
        <form className="card" onSubmit={save}>
          <div className="field">
            <label htmlFor="edit-title">Nome *</label>
            <input
              id="edit-title"
              name="title"
              defaultValue={product.title}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="edit-description">Descrição</label>
            <textarea
              id="edit-description"
              name="description"
              defaultValue={product.description ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-image">Foto principal (URL)</label>
            <input
              id="edit-image"
              name="image"
              type="url"
              defaultValue={product.thumbnail ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-price">Preço na minha loja (R$)</label>
            <input
              id="edit-price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product.retailPrice ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-sku">SKU</label>
            <input id="edit-sku" name="sku" defaultValue={product.sku ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="edit-availability">
              Disponibilidade do fornecedor
            </label>
            <select
              id="edit-availability"
              name="availability"
              defaultValue={product.availability ?? "UNKNOWN"}
              disabled={!product.supplier}
            >
              <option value="UNKNOWN">Não confirmada</option>
              <option value="IN_STOCK">Disponível</option>
              <option value="OUT_OF_STOCK">Sem estoque</option>
            </select>
          </div>
          <p className="muted">
            Fornecedor: {product.supplier ?? "não vinculado"}. O vínculo técnico
            é mantido no cadastro avançado.
          </p>
          <button disabled={busy}>{busy ? "SALVANDO..." : "SALVAR"}</button>{" "}
          <a
            className="button secondary"
            href={`/vitrine?produto=${productId}`}
          >
            VOLTAR À VITRINE
          </a>
        </form>
      )}
    </Shell>
  );
}
function Search({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    Array<{
      id: string;
      title: string;
      image: string | null;
      priceMin: string | null;
      priceMax: string | null;
      currency: string | null;
    }>
  >([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string>();
  const [stage, setStage] = useState("");
  const [createdProductId, setCreatedProductId] = useState<string>();
  async function load(searchKeyword: string, targetPage: number) {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ items: typeof results; total: number }>(
        `admin/achilles/integrations/cj/products?keyword=${encodeURIComponent(searchKeyword)}&page=${targetPage}&size=20`,
      );
      setResults(Array.isArray(r.items) ? r.items : []);
      setTotal(Number.isFinite(r.total) ? r.total : 0);
      setKeyword(searchKeyword);
      setPage(targetPage);
    } catch {
      setResults([]);
      setError("Não foi possível consultar a CJ. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }
  async function search(e: FormEvent) {
    e.preventDefault();
    await load(q.trim(), 1);
  }
  async function importProduct(product: (typeof results)[number]) {
    setBusy(product.id);
    setError("");
    setMessage("");
    setCreatedProductId(undefined);
    try {
      setStage("Buscando detalhes...");
      const detail = await api<{
        product: typeof product & {
          description?: string | null;
          images?: string[];
          price?: string | null;
        };
      }>(`admin/achilles/integrations/cj/products/${product.id}`, {
        timeoutMs: LONG_API_TIMEOUT_MS,
      });
      setStage("Verificando opções...");
      const variantResult = await api<{
        variants: Array<{ id: string; sku: string; title: string }>;
      }>(
        `admin/achilles/integrations/cj/variants?pid=${encodeURIComponent(product.id)}`,
        { timeoutMs: LONG_API_TIMEOUT_MS },
      );
      if (!variantResult.variants.length) {
        throw new Error(
          "Este produto não possui uma variação disponível para importar.",
        );
      }
      setStage("Criando rascunho...");
      const imported = await api<{ product: { id: string } }>(
        "admin/achilles/integrations/cj/import",
        {
          method: "POST",
          timeoutMs: LONG_API_TIMEOUT_MS,
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
        },
      );
      setCreatedProductId(imported.product.id);
      setMessage("PRODUTO ADICIONADO");
    } catch (x) {
      if (x instanceof ApiError && x.code === "CJ_PRODUCT_ALREADY_IMPORTED") {
        const productId =
          typeof x.details?.productId === "string"
            ? x.details.productId
            : undefined;
        setCreatedProductId(productId);
        setMessage("Este produto já está na sua vitrine.");
        return;
      }
      setError(
        x instanceof Error ? x.message : "Não foi possível importar o produto.",
      );
    } finally {
      setBusy(undefined);
      setStage("");
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
          {message}{" "}
          <a
            href={
              createdProductId
                ? `/vitrine?produto=${createdProductId}`
                : "/vitrine"
            }
          >
            ABRIR NA MINHA VITRINE
          </a>
        </div>
      )}
      {busy && stage && <div className="state">{stage}</div>}
      {loading && <div className="state">Buscando produtos...</div>}
      {!loading && keyword && !error && results.length === 0 && (
        <div className="state">Nenhum produto encontrado.</div>
      )}
      {!loading && results.length > 0 && (
        <div className="toolbar">
          <strong>{total} produtos</strong>
          <button
            type="button"
            className="secondary"
            disabled={page === 1}
            onClick={() => void load(keyword, page - 1)}
          >
            ANTERIOR
          </button>
          <button
            type="button"
            className="secondary"
            disabled={page * 20 >= total}
            onClick={() => void load(keyword, page + 1)}
          >
            PRÓXIMA
          </button>
        </div>
      )}
      <div className="products" aria-live="polite">
        {results.map((p) => (
          <article className="product-card" key={p.id}>
            <CJCardImage src={p.image} title={p.title} />
            <div className="product-body">
              <h2>{p.title}</h2>
              <p>
                Custo CJ: {p.priceMin ?? "Consultar preço"}
                {p.priceMax && p.priceMax !== p.priceMin
                  ? ` – ${p.priceMax}`
                  : ""}{" "}
                {p.priceMin ? (p.currency ?? "USD") : ""}
              </p>
              <button
                disabled={Boolean(busy)}
                onClick={() => void importProduct(p)}
              >
                {busy === p.id ? stage || "ADICIONANDO..." : "ADICIONAR"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CJCardImage({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="product-image">
      {src && !failed ? (
        <Image
          src={src}
          alt={title}
          fill
          unoptimized
          loader={({ src: imageSource }) => imageSource}
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        "Sem foto"
      )}
    </div>
  );
}
