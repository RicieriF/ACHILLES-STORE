import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Text,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/page-state";
import { sdk } from "../../lib/sdk";
import { fulfillmentLabels, type SupplierOffer } from "../../lib/types";

type OfferList = { offers: SupplierOffer[]; count: number };

const OfferEditor = ({ offer }: { offer: SupplierOffer }) => {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [unitCost, setUnitCost] = useState(offer.unit_cost);
  const [moq, setMoq] = useState(String(offer.moq));
  const [mode, setMode] = useState(offer.fulfillment_mode);
  const [notes, setNotes] = useState(offer.notes ?? "");
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/offers/${offer.id}`, {
        method: "POST",
        body: {
          unit_cost: unitCost,
          moq: Number(moq),
          fulfillment_mode: mode,
          notes: notes || null,
        },
      }),
    onSuccess: async () => {
      setEditing(false);
      await client.invalidateQueries({ queryKey: ["achilles-offers"] });
    },
  });
  if (!editing)
    return (
      <Button
        variant="secondary"
        onClick={() => {
          setEditing(true);
        }}
      >
        Editar oferta
      </Button>
    );
  return (
    <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-2">
      <Input
        placeholder="Custo unitário"
        value={unitCost}
        onChange={(event) => {
          setUnitCost(event.target.value);
        }}
      />
      <Input
        placeholder="MOQ"
        value={moq}
        onChange={(event) => {
          setMoq(event.target.value);
        }}
      />
      <Select value={mode} onValueChange={setMode}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="PRIVATE_LABEL_DROPSHIP">
            Dropshipping com Marca Própria
          </Select.Item>
          <Select.Item value="GENERIC_DROPSHIP">
            Dropshipping Genérico
          </Select.Item>
          <Select.Item value="BRAZIL_STOCK">Estoque Brasil</Select.Item>
        </Select.Content>
      </Select>
      <Input
        placeholder="Observações"
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
      <div className="flex gap-2">
        <Button
          disabled={save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          Salvar oferta
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(false);
          }}
        >
          Cancelar
        </Button>
      </div>
      {save.isError && <ErrorState message={String(save.error)} />}
    </div>
  );
};

const ProductsSuppliersPage = () => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["achilles-offers"],
    queryFn: () => sdk.client.fetch<OfferList>("/admin/achilles/offers"),
  });
  const primary = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/achilles/offers/${id}/primary`, {
        method: "POST",
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["achilles-offers"] }),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Produtos e Fornecedores</Heading>
        <Text className="text-ui-fg-subtle">
          Ofertas vinculadas ao catálogo Medusa. O produto permanece
          independente das ofertas.
        </Text>
      </Container>
      {!query.data.offers.length ? (
        <EmptyState>
          Nenhuma oferta vinculada. Adicione uma pela área Fornecimento do
          produto.
        </EmptyState>
      ) : (
        query.data.offers.map((offer) => (
          <Container key={offer.id}>
            <div className="flex justify-between gap-4">
              <div>
                <Heading level="h2">
                  {offer.supplier?.name || "Fornecedor"} ·{" "}
                  {offer.supplier_product_id}
                </Heading>
                <Text>Produto: {offer.product_id}</Text>
                <Text>
                  {offer.currency} {offer.unit_cost} · MOQ {offer.moq}
                </Text>
                <Text>
                  {fulfillmentLabels[offer.fulfillment_mode] ||
                    offer.fulfillment_mode}
                </Text>
                <Text>
                  {offer.private_label_supported
                    ? "Private label disponível"
                    : "Sem private label"}
                </Text>
              </div>
              <div className="flex flex-col items-end gap-2">
                {offer.is_primary ? (
                  <Badge color="green">Fornecedor principal</Badge>
                ) : (
                  <Badge color="grey">Alternativo</Badge>
                )}
                <Badge color={offer.status === "ACTIVE" ? "green" : "grey"}>
                  {offer.status === "ACTIVE" ? "Ativa" : "Inativa"}
                </Badge>
                {!offer.is_primary && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      primary.mutate(offer.id);
                    }}
                  >
                    Definir como principal
                  </Button>
                )}
                <a
                  className="text-ui-fg-interactive"
                  href={offer.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir origem
                </a>
              </div>
            </div>
            <OfferEditor offer={offer} />
          </Container>
        ))
      )}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "ACHILLES · Produtos e Fornecedores",
});
export default ProductsSuppliersPage;
