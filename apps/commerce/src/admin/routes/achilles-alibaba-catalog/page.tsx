import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type Product = {
  id: string;
  title: string;
  image: string | null;
  images: string[];
  description: string | null;
  priceMin: string | null;
  priceMax: string | null;
  currency: string | null;
  supplier: string | null;
  moq: number | null;
  sourceUrl: string | null;
  variants: Array<{
    id: string | null;
    title: string | null;
    price: string | null;
    inventory: number | null;
  }>;
};
const productId = (value: string) => value.match(/\d{3,30}/)?.[0] ?? "";

const AlibabaCatalogPage = () => {
  const [draft, setDraft] = useState("");
  const [id, setId] = useState("");
  const [zip, setZip] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const product = useQuery({
    queryKey: ["alibaba-product", id],
    queryFn: () =>
      sdk.client.fetch<{ product: Product | null }>(
        `/admin/achilles/integrations/alibaba/products/${id}`,
      ),
    enabled: Boolean(id),
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
      }>("/admin/achilles/integrations/alibaba/freight", {
        method: "POST",
        body: {
          productId: id,
          quantity: Number(quantity),
          zipCode: zip,
          dispatchLocation: "CN",
        },
      }),
  });
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ draft: { id: string }; reused: boolean }>(
        "/admin/achilles/imports",
        {
          method: "POST",
          body: {
            source_url:
              product.data?.product?.sourceUrl ??
              `https://www.alibaba.com/product-detail/achilles_${id}.html`,
          },
        },
      ),
    onSuccess: (result) => {
      setMessage(
        result.reused
          ? "Este produto Alibaba já está vinculado. Abra o draft existente."
          : "Draft Alibaba criado. Revise e aprove antes de criar o produto.",
      );
    },
  });
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">ACHILLES · ALIBABA CATÁLOGO</Heading>
        <Text className="text-ui-fg-subtle">
          Pesquisa geral não disponível para esta autorização. Consulte por
          Product ID ou URL usando somente a API oficial.
        </Text>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Product ID ou URL Alibaba"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
          <Button
            disabled={!productId(draft)}
            onClick={() => {
              setId(productId(draft));
            }}
          >
            CONSULTAR
          </Button>
        </div>
      </Container>
      {product.isPending && id ? (
        <LoadingState />
      ) : product.isError ? (
        <ErrorState message={String(product.error)} />
      ) : product.data?.product ? (
        <Container>
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            {product.data.product.image && (
              <img
                src={product.data.product.image}
                alt=""
                className="h-60 w-full object-contain"
              />
            )}
            <div>
              <Heading level="h2">{product.data.product.title}</Heading>
              <Text>
                Product ID {id} · Fornecedor{" "}
                {product.data.product.supplier ?? "não retornado"}
              </Text>
              <Text>
                MOQ {product.data.product.moq ?? "—"} ·{" "}
                {product.data.product.priceMin ?? "—"}–
                {product.data.product.priceMax ?? "—"}{" "}
                {product.data.product.currency ?? ""}
              </Text>
              <Text>
                {product.data.product.description || "Sem descrição retornada."}
              </Text>
              <Text>
                Variantes retornadas: {product.data.product.variants.length}
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
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
                  onClick={() => {
                    save.mutate();
                  }}
                >
                  SALVAR DRAFT
                </Button>
              </div>
            </div>
          </div>
          {freight.data?.quotes.map((quote, index) => (
            <Text key={index}>
              {quote.method ?? "Frete"} · {quote.price ?? "—"}{" "}
              {quote.currency ?? ""} ·{" "}
              {quote.deliveryTime ?? "prazo não informado"}
            </Text>
          ))}
          {(freight.isError || save.isError) && (
            <ErrorState message={String(freight.error ?? save.error)} />
          )}
          {message && <Text className="mt-2">{message}</Text>}
        </Container>
      ) : null}
    </div>
  );
};
export const config = defineRouteConfig({});
export default AlibabaCatalogPage;
