import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";
import type { ImportDraft } from "../../lib/types";

type List = { drafts: ImportDraft[]; count: number };
type Conversion = {
  product_id: string;
  supplier_id: string;
  supplier_offer_id: string;
  cost_quote_id: string;
  product_policy_id: string;
  idempotent: boolean;
  commercial_readiness: string;
  compliance_status: string;
};
const labels: Record<ImportDraft["status"], string> = {
  FETCHING: "Coletando",
  PARSED: "Coletado",
  NEEDS_REVIEW: "Revisão necessária",
  APPROVED: "Aprovado para próxima etapa",
  REJECTED: "Rejeitado",
  FAILED: "Falhou",
};
const ImportsPage = () => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<ImportDraft>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("");
  const [price, setPrice] = useState("");
  const [moq, setMoq] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState("");
  const list = useQuery({
    queryKey: ["achilles-imports"],
    queryFn: () => sdk.client.fetch<List>("/admin/achilles/imports"),
  });
  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: ["achilles-imports"] });
  const choose = (draft: ImportDraft) => {
    setSelected(draft);
    setTitle(draft.title_normalized ?? "");
    setDescription(draft.description_normalized ?? "");
    setCurrency(draft.source_currency ?? "");
    setPrice(draft.source_price_min ?? "");
    setMoq(draft.moq?.toString() ?? "");
    setCategory(draft.category_suggested ?? "");
    setImages(draft.media.items.join(", "));
  };
  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ draft: ImportDraft; reused: boolean }>(
        "/admin/achilles/imports",
        { method: "POST", body: { source_url: url } },
      ),
    onSuccess: async ({ draft, reused }) => {
      choose(draft);
      setUrl("");
      await refresh();
      toast.success(
        reused
          ? "Rascunho existente reutilizado"
          : "Rascunho criado para revisão",
      );
    },
    onError: () =>
      toast.error("URL inválida, host não permitido ou coleta indisponível"),
  });
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      sdk.client.fetch<{ draft: ImportDraft }>(
        `/admin/achilles/imports/${selected?.id ?? ""}/${path}`,
        { method: "POST", body: body as Record<string, unknown> | undefined },
      ),
    onSuccess: async ({ draft }) => {
      choose(draft);
      await refresh();
      toast.success("Ação registrada");
    },
    onError: (error) => toast.error(String(error)),
  });
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ draft: ImportDraft }>(
        `/admin/achilles/imports/${selected?.id ?? ""}`,
        {
          method: "PATCH",
          body: {
            title_normalized: title,
            description_normalized: description || null,
            source_currency: currency || null,
            source_price_min: price || null,
            moq: moq ? Number(moq) : null,
            category_suggested: category || null,
            media: images
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          },
        },
      ),
    onSuccess: async ({ draft }) => {
      choose(draft);
      await refresh();
      toast.success("Rascunho salvo");
    },
    onError: (error) => toast.error(String(error)),
  });
  const convert = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ conversion: Conversion }>(
        `/admin/achilles/imports/${selected?.id ?? ""}/convert`,
        { method: "POST" },
      ),
    onSuccess: async ({ conversion }) => {
      if (selected)
        setSelected({
          ...selected,
          converted_product_id: conversion.product_id,
          conversion_status: "COMPLETED",
        });
      await refresh();
      toast.success(
        conversion.idempotent
          ? "Este rascunho já estava em Produtos"
          : "Rascunho enviado para Produtos",
      );
    },
    onError: (error) => toast.error(String(error)),
  });
  return (
    <div className="flex flex-col gap-4">
      <Container>
        <Heading level="h1">Importar produto</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Encontre no CJ ou cole uma URL externa. Todo produto nasce como
          rascunho e exige revisão antes de publicar.
        </Text>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border p-4">
            <Heading level="h2">CJdropshipping</Heading>
            <Text className="text-ui-fg-subtle">
              Busque produtos, veja variantes e importe os dados disponíveis.
            </Text>
            <a href="/app/achilles-cj-catalog">
              <Button className="mt-3">BUSCAR PRODUTOS</Button>
            </a>
          </div>
          <div className="rounded border p-4">
            <Heading level="h2">URL externa</Heading>
            <Text className="text-ui-fg-subtle">
              Alibaba, AliExpress ou outro fornecedor HTTPS. Sem scraping:
              complete somente o que faltar.
            </Text>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            aria-label="URL do fornecedor"
            placeholder="Cole a URL do produto"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
          <Button
            onClick={() => {
              create.mutate();
            }}
            disabled={!url || create.isPending}
          >
            CONTINUAR
          </Button>
        </div>
        {create.isError && (
          <ErrorState message="Use uma URL HTTPS válida do produto. Endereços locais e URLs com credenciais são bloqueados." />
        )}
      </Container>
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState message={String(list.error)} />
      ) : !list.data.drafts.length ? (
        <Container>
          <Text>
            Nenhum rascunho de importação. Busque no CJ ou cole uma URL externa.
          </Text>
        </Container>
      ) : (
        list.data.drafts.map((draft) => (
          <Container key={draft.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Text weight="plus">
                  {draft.title_normalized ||
                    draft.title_raw ||
                    "Título pendente"}
                </Text>
                <Text className="text-ui-fg-subtle break-all">
                  {draft.canonical_source_url}
                </Text>
                <Text className="text-ui-fg-subtle">
                  {draft.provider === "ALIEXPRESS"
                    ? "AliExpress"
                    : draft.provider === "ALIBABA"
                      ? "Alibaba"
                      : "Outro fornecedor"}{" "}
                  · {draft.source_currency || "moeda pendente"}{" "}
                  {draft.source_price_min || "preço pendente"} · MOQ{" "}
                  {draft.moq ?? "pendente"}
                </Text>
              </div>
              <div className="flex gap-2">
                <Badge
                  color={
                    draft.compliance_status === "BLOCKED"
                      ? "red"
                      : draft.compliance_status === "REVIEW_REQUIRED"
                        ? "orange"
                        : "green"
                  }
                >
                  {draft.compliance_status === "CLEAR"
                    ? "Sem bloqueio identificado"
                    : draft.compliance_status === "REVIEW_REQUIRED"
                      ? "Pendente de revisão"
                      : "Bloqueado"}
                </Badge>
                <Badge>{labels[draft.status]}</Badge>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    choose(draft);
                  }}
                >
                  Revisar
                </Button>
              </div>
            </div>
            {draft.failure_reason && (
              <Text className="mt-2 text-ui-fg-error">
                {draft.failure_reason}
              </Text>
            )}
            {draft.alerts.items.map((alert) => (
              <Text key={alert} className="mt-1 text-ui-fg-subtle">
                ⚠ {alert}
              </Text>
            ))}
          </Container>
        ))
      )}
      {selected && (
        <Container>
          <Heading level="h2">Revisar rascunho</Heading>
          <Text className="mt-1 text-ui-fg-subtle">
            Original: {selected.title_raw || "não coletado"}
          </Text>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label>
              <Text>Título sugerido</Text>
              <Input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
              />
            </label>
            <label>
              <Text>Categoria sugerida</Text>
              <Input
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                }}
              />
            </label>
            <label>
              <Text>Moeda</Text>
              <Input
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                }}
              />
            </label>
            <label>
              <Text>Preço mínimo</Text>
              <Input
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                }}
              />
            </label>
            <label>
              <Text>MOQ</Text>
              <Input
                type="number"
                value={moq}
                onChange={(event) => {
                  setMoq(event.target.value);
                }}
              />
            </label>
            <label className="col-span-2">
              <Text>Descrição sugerida</Text>
              <Textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </label>
            <label className="col-span-2">
              <Text>Fotos (URLs separadas por vírgula)</Text>
              <Input
                value={images}
                onChange={(event) => {
                  setImages(event.target.value);
                }}
                placeholder="https://.../foto.jpg"
              />
            </label>
          </div>
          <Text className="mt-3">
            Fotos: {selected.media.items.length} · Variantes:{" "}
            {selected.variants.items.length} · Especificações:{" "}
            {Object.keys(selected.specifications).length}
          </Text>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                save.mutate();
              }}
              disabled={
                save.isPending ||
                ["APPROVED", "REJECTED"].includes(selected.status)
              }
            >
              Salvar rascunho
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                action.mutate({ path: "reprocess" });
              }}
            >
              Reprocessar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                action.mutate({ path: "approve" });
              }}
            >
              Aprovar rascunho
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                action.mutate({
                  path: "reject",
                  body: { reason: "Rejeitado após revisão humana" },
                });
              }}
            >
              Rejeitar rascunho
            </Button>
          </div>
          <Text className="mt-3 text-ui-fg-subtle">
            Aprovar libera o envio para Produtos como rascunho. Nenhum item é
            publicado automaticamente.
          </Text>
          {selected.converted_product_id ? (
            <div className="mt-4 rounded border p-3">
              <Text weight="plus">Rascunho enviado para Produtos</Text>
              <Text>Defina o preço em Produtos antes de publicar.</Text>
              <a
                className="text-ui-fg-interactive"
                href={`/app/achilles-catalog?q=${encodeURIComponent(selected.title_normalized || selected.title_raw || "")}`}
              >
                ABRIR EM PRODUTOS
              </a>
            </div>
          ) : selected.status === "APPROVED" ? (
            <div className="mt-4">
              <Button
                disabled={convert.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Enviar para Produtos como rascunho? Esta ação não publica o produto.",
                    )
                  )
                    convert.mutate();
                }}
              >
                ENVIAR PARA PRODUTOS
              </Button>
              <Text className="mt-2 text-ui-fg-subtle">
                O item entra em Produtos como rascunho. Defina o preço e
                publique depois.
              </Text>
            </div>
          ) : null}
          {selected.conversion_failure_reason && (
            <ErrorState message={selected.conversion_failure_reason} />
          )}
        </Container>
      )}
    </div>
  );
};
export const config = defineRouteConfig({ label: "IMPORTAR", rank: 30 });
export default ImportsPage;
