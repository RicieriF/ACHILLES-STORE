import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type {
  AdminProduct,
  DetailWidgetProps,
} from "@medusajs/framework/types";
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
import { EmptyState, ErrorState, LoadingState } from "../components/page-state";
import { sdk } from "../lib/sdk";
import {
  fulfillmentLabels,
  type Supplier,
  type SupplierOffer,
} from "../lib/types";

type OfferList = { offers: SupplierOffer[] };
type SupplierList = { suppliers: Supplier[] };

const ProductSupplyWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const client = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [supplierProductId, setSupplierProductId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const offers = useQuery({
    queryKey: ["product-supply", data.id],
    queryFn: () =>
      sdk.client.fetch<OfferList>("/admin/achilles/offers", {
        query: { product_id: data.id },
      }),
  });
  const suppliers = useQuery({
    queryKey: ["achilles-active-suppliers"],
    queryFn: () =>
      sdk.client.fetch<SupplierList>("/admin/achilles/suppliers", {
        query: { status: "ACTIVE", limit: 100 },
      }),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["product-supply", data.id] });
  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/achilles/offers", {
        method: "POST",
        body: {
          supplier_id: supplierId,
          product_id: data.id,
          supplier_product_id: supplierProductId,
          source_url: sourceUrl,
          currency: "USD",
          unit_cost: unitCost,
          moq: 1,
          availability: "UNKNOWN",
          status: "ACTIVE",
          fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
          private_label_supported: false,
          is_primary: !offers.data?.offers.length,
        },
      }),
    onSuccess: async () => {
      setSourceUrl("");
      setSupplierProductId("");
      setUnitCost("");
      await refresh();
    },
  });
  const primary = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/achilles/offers/${id}/primary`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: (offer: SupplierOffer) =>
      sdk.client.fetch(`/admin/achilles/offers/${offer.id}`, {
        method: "POST",
        body: { status: offer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/achilles/offers/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Fornecimento</Heading>
        <Text className="text-ui-fg-subtle">
          Fornecedor principal, alternativas e condições comerciais.
        </Text>
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">
        {offers.isPending ? (
          <LoadingState />
        ) : offers.isError ? (
          <ErrorState message={String(offers.error)} />
        ) : !offers.data.offers.length ? (
          <EmptyState>Nenhum fornecedor associado.</EmptyState>
        ) : (
          offers.data.offers.map((offer) => (
            <div key={offer.id} className="rounded border p-3">
              <div className="flex justify-between">
                <div>
                  <Text weight="plus">
                    {offer.supplier?.name || offer.supplier_product_id}
                  </Text>
                  <Text>
                    {offer.currency} {offer.unit_cost} · MOQ {offer.moq}
                  </Text>
                  <Text>{fulfillmentLabels[offer.fulfillment_mode]}</Text>
                  <Text>
                    {offer.private_label_supported
                      ? "Private label: sim"
                      : "Private label: não"}{" "}
                    · Sync: {offer.last_sync_at || "nunca"}
                  </Text>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {offer.is_primary ? (
                    <Badge color="green">Principal</Badge>
                  ) : (
                    <Badge color="grey">Alternativo</Badge>
                  )}
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={offer.is_primary}
                    onClick={() => {
                      primary.mutate(offer.id);
                    }}
                  >
                    Definir principal
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => {
                      toggle.mutate(offer);
                    }}
                  >
                    {offer.status === "ACTIVE" ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => {
                      remove.mutate(offer.id);
                    }}
                  >
                    Remover vínculo
                  </Button>
                  <a
                    href={offer.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-fg-interactive"
                  >
                    Abrir origem
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-6 py-4">
        <Heading level="h3">Adicionar fornecedor</Heading>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <Select.Trigger>
              <Select.Value placeholder="Fornecedor ativo" />
            </Select.Trigger>
            <Select.Content>
              {suppliers.data?.suppliers.map((supplier) => (
                <Select.Item key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            placeholder="ID do produto no fornecedor"
            value={supplierProductId}
            onChange={(e) => {
              setSupplierProductId(e.target.value);
            }}
          />
          <Input
            placeholder="URL de origem HTTPS"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
            }}
          />
          <Input
            placeholder="Custo unitário USD"
            value={unitCost}
            onChange={(e) => {
              setUnitCost(e.target.value);
            }}
          />
          <Button
            disabled={
              create.isPending ||
              !supplierId ||
              !sourceUrl ||
              !supplierProductId ||
              !unitCost
            }
            onClick={() => {
              create.mutate();
            }}
          >
            Adicionar oferta
          </Button>
        </div>
        {create.isError && <ErrorState message={String(create.error)} />}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: "product.details" });
export default ProductSupplyWidget;
