import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type Card = {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  priceMin: string | null;
  priceMax: string | null;
  currency: string | null;
};
type Variant = { id: string; sku: string; title: string; price: string | null };
type Catalog = { items: Card[]; total: number; page: number; size: number };
type Detail = {
  product: Card & {
    description?: string | null;
    images?: string[];
    weight?: string | null;
    dimensions?: Record<string, string | null>;
    price?: string | null;
  };
};

const CJCatalogPage = () => {
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Card | null>(null);
  const [zip, setZip] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const catalog = useQuery({
    queryKey: ["cj-products", keyword, page],
    queryFn: () =>
      sdk.client.fetch<Catalog>("/admin/achilles/integrations/cj/products", {
        query: { keyword, page, size: 20 },
      }),
    enabled: keyword.length >= 2,
  });
  const detail = useQuery({
    queryKey: ["cj-product", selected?.id],
    queryFn: () =>
      sdk.client.fetch<Detail>(
        `/admin/achilles/integrations/cj/products/${selected?.id ?? ""}`,
      ),
    enabled: Boolean(selected),
  });
  const variants = useQuery({
    queryKey: ["cj-variants", selected?.id],
    queryFn: () =>
      sdk.client.fetch<{ variants: Variant[] }>(
        "/admin/achilles/integrations/cj/variants",
        { query: { pid: selected?.id } },
      ),
    enabled: Boolean(selected),
  });
  const stock = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        stock: Array<{
          warehouse: string | null;
          country: string | null;
          quantity: number | null;
        }>;
      }>("/admin/achilles/integrations/cj/stock", {
        query: { vid: variants.data?.variants[0]?.id },
      }),
  });
  const freight = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{
        quotes: Array<{
          method: string | null;
          price: string | null;
          currency: string | null;
          deliveryTime: string | null;
        }>;
      }>("/admin/achilles/integrations/cj/freight", {
        method: "POST",
        body: {
          startCountryCode: "CN",
          endCountryCode: "BR",
          zip,
          products: [
            { vid: variants.data?.variants[0]?.id, quantity: Number(quantity) },
          ],
        },
      }),
  });
  const save = useMutation({
    mutationFn: () => {
      const product = detail.data?.product;
      const choices = variants.data?.variants ?? [];
      if (!selected || !product || !choices.length)
        throw new Error("Consulte os detalhes e variantes antes de salvar.");
      return sdk.client.fetch<{ product: { id: string } }>(
        "/admin/achilles/integrations/cj/import",
        {
          method: "POST",
          body: {
            pid: selected.id,
            title: product.title,
            description: product.description ?? "",
            images: product.images ?? (product.image ? [product.image] : []),
            sourceUrl: `https://cjdropshipping.com/product/${selected.id}`,
            currency: product.currency ?? "USD",
            sourceCost: product.price ?? selected.priceMin ?? "0",
            variants: choices.map((item) => ({
              vid: item.id,
              sku: item.sku,
              title: item.title,
            })),
          },
        },
      );
    },
    onSuccess: () => {
      setMessage("Rascunho CJ criado. Complete os dados antes de publicar.");
    },
  });
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">ACHILLES · CJ CATÁLOGO</Heading>
        <Text className="text-ui-fg-subtle">
          Consulta oficial sob demanda. Salvar cria somente Product DRAFT e
          SupplierOffer.
        </Text>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Palavra-chave"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
          <Button
            disabled={draft.trim().length < 2}
            onClick={() => {
              setPage(1);
              setKeyword(draft.trim());
            }}
          >
            BUSCAR
          </Button>
        </div>
      </Container>
      {catalog.isPending && keyword ? (
        <LoadingState />
      ) : catalog.isError ? (
        <ErrorState message={String(catalog.error)} />
      ) : catalog.data ? (
        <Container>
          <div className="flex justify-between">
            <Heading level="h2">{catalog.data.total} produtos</Heading>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1);
                }}
              >
                ANTERIOR
              </Button>
              <Button
                variant="secondary"
                disabled={page * 20 >= catalog.data.total}
                onClick={() => {
                  setPage(page + 1);
                }}
              >
                PRÓXIMA
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {catalog.data.items.map((item) => (
              <article key={item.id} className="rounded-lg border p-3">
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    className="h-40 w-full object-contain"
                  />
                )}
                <Heading level="h3">{item.title}</Heading>
                <Text>
                  SKU {item.sku ?? "—"} · ID {item.id}
                </Text>
                <Text>
                  {item.priceMin ?? "—"}–{item.priceMax ?? "—"} {item.currency}
                </Text>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelected(item);
                    }}
                  >
                    VER DETALHES
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Container>
      ) : (
        <Container>
          <Text>Informe uma palavra-chave para consultar produtos.</Text>
        </Container>
      )}
      {selected && (
        <Container>
          <Heading level="h2">Detalhes · {selected.title}</Heading>
          {detail.isPending || variants.isPending ? (
            <LoadingState />
          ) : (
            <>
              <Text>
                {detail.data?.product.description || "Sem descrição retornada."}
              </Text>
              <Text>
                Peso {detail.data?.product.weight ?? "—"} · Variantes{" "}
                {variants.data?.variants.length ?? 0}
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    stock.mutate();
                  }}
                >
                  CONSULTAR ESTOQUE
                </Button>
                <Input
                  className="w-32"
                  placeholder="CEP"
                  value={zip}
                  onChange={(event) => {
                    setZip(event.target.value.replace(/\D/g, "").slice(0, 8));
                  }}
                />
                <Input
                  className="w-20"
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={zip.length !== 8}
                  onClick={() => {
                    freight.mutate();
                  }}
                >
                  CALCULAR FRETE
                </Button>
                <Button
                  disabled={save.isPending || !variants.data?.variants.length}
                  onClick={() => {
                    save.mutate();
                  }}
                >
                  SALVAR DRAFT
                </Button>
              </div>
              {stock.data?.stock.map((row, index) => (
                <Text key={index}>
                  {row.warehouse ?? "Warehouse"} · {row.country ?? "—"} ·{" "}
                  {row.quantity ?? "—"}
                </Text>
              ))}
              {freight.data?.quotes.map((row, index) => (
                <Text key={index}>
                  {row.method ?? "Frete"} · {row.price ?? "—"}{" "}
                  {row.currency ?? ""} ·{" "}
                  {row.deliveryTime ?? "prazo não informado"}
                </Text>
              ))}
              {(stock.isError || freight.isError || save.isError) && (
                <ErrorState
                  message={String(stock.error ?? freight.error ?? save.error)}
                />
              )}
              {message && <Text className="mt-2">{message}</Text>}
            </>
          )}
        </Container>
      )}
    </div>
  );
};
export const config = defineRouteConfig({ label: "AVANÇADO · Catálogo CJ" });
export default CJCatalogPage;
