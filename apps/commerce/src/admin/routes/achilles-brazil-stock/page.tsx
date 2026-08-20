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
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";
import type { Supplier, SupplierOffer } from "../../lib/types";

type Product = { id: string; title: string };
type Data = { suppliers: Supplier[] };
type Offers = { offers: SupplierOffer[] };
const BrazilStockPage = () => {
  const client = useQueryClient();
  const [supplierName, setSupplierName] = useState("");
  const [offer, setOffer] = useState({
    supplier_id: "",
    product_id: "",
    supplier_product_id: "",
    source_url: "",
    unit_cost: "",
    stock: "0",
    delivery_days: "3",
    origin: "",
    shipping_mode: "DOMESTIC_MANUAL",
    tracking: "true",
  });
  const query = useQuery({
    queryKey: ["brazil-stock"],
    queryFn: async () => {
      const [suppliers, offers, products] = await Promise.all([
        sdk.client.fetch<Data>("/admin/achilles/suppliers", {
          query: { limit: 100 },
        }),
        sdk.client.fetch<Offers>("/admin/achilles/offers", {
          query: { limit: 100 },
        }),
        sdk.client.fetch<{ products: Product[] }>("/admin/products", {
          query: { limit: 100, fields: "id,title" },
        }),
      ]);
      return {
        suppliers: suppliers.suppliers.filter(
          (item) => item.provider === "BRAZIL_STOCK",
        ),
        offers: offers.offers.filter(
          (item) => item.fulfillment_mode === "BRAZIL_STOCK",
        ),
        products: products.products,
      };
    },
  });
  const createSupplier = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/achilles/suppliers", {
        method: "POST",
        body: {
          name: supplierName,
          provider: "BRAZIL_STOCK",
          status: "ACTIVE",
          country_code: "BR",
          notes: "Operação nacional manual",
          metadata: { nfe_capability: "FUTURE", fulfillment_status: "MANUAL" },
        },
      }),
    onSuccess: async () => {
      setSupplierName("");
      await client.invalidateQueries({ queryKey: ["brazil-stock"] });
    },
  });
  const createOffer = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/achilles/offers", {
        method: "POST",
        body: {
          supplier_id: offer.supplier_id,
          product_id: offer.product_id,
          supplier_product_id: offer.supplier_product_id,
          source_url: offer.source_url,
          currency: "BRL",
          unit_cost: offer.unit_cost,
          moq: 1,
          availability: Number(offer.stock) > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
          availability_quantity: Number(offer.stock),
          status: "ACTIVE",
          fulfillment_mode: "BRAZIL_STOCK",
          private_label_supported: false,
          is_primary: false,
          freight_metadata: {
            delivery_days: Number(offer.delivery_days),
            origin: offer.origin,
            shipping_mode: offer.shipping_mode,
            tracking_supported: offer.tracking === "true",
            nfe_capability: "FUTURE",
          },
          notes: "Oferta nacional configurada manualmente",
        },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["brazil-stock"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (supplier: Supplier) =>
      sdk.client.fetch(`/admin/achilles/suppliers/${supplier.id}`, {
        method: "POST",
        body: { status: supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      }),
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: ["brazil-stock"] }),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3" data-testid="brazil-stock-page">
      <Container>
        <Heading level="h1">ACHILLES · Estoque Brasil</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Cadastro operacional manual de fornecedor, oferta, estoque e prazo.
          Não é ERP e NF-e permanece futura.
        </Text>
      </Container>
      <Container>
        <Heading level="h2">Fornecedor nacional</Heading>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Nome real do fornecedor"
            value={supplierName}
            onChange={(event) => {
              setSupplierName(event.target.value);
            }}
          />
          <Button
            disabled={
              supplierName.trim().length < 2 || createSupplier.isPending
            }
            onClick={() => {
              createSupplier.mutate();
            }}
          >
            Cadastrar
          </Button>
        </div>
        {createSupplier.isError && (
          <ErrorState message={String(createSupplier.error)} />
        )}
      </Container>
      <Container>
        <Heading level="h2">Fornecedores ativos</Heading>
        <Text className="text-ui-fg-subtle">
          Use ACHILLES · Fornecedores para editar contato e observações do
          cadastro.
        </Text>
        <div className="mt-4 grid gap-2">
          {query.data.suppliers.length ? (
            query.data.suppliers.map((supplier) => (
              <div
                className="flex items-center justify-between rounded border p-3"
                key={supplier.id}
              >
                <div>
                  <Text>
                    <strong>{supplier.name}</strong>
                  </Text>
                  <Text>BR · tracking conforme oferta · NF-e FUTURE</Text>
                </div>
                <div className="flex gap-2">
                  <Badge
                    color={supplier.status === "ACTIVE" ? "green" : "grey"}
                  >
                    {supplier.status}
                  </Badge>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      toggle.mutate(supplier);
                    }}
                  >
                    {supplier.status === "ACTIVE" ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <Text>Nenhum fornecedor nacional cadastrado.</Text>
          )}
        </div>
      </Container>
      <Container>
        <Heading level="h2">Registrar oferta nacional</Heading>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Text>Fornecedor</Text>
            <Select
              value={offer.supplier_id}
              onValueChange={(value) => {
                setOffer({ ...offer, supplier_id: value });
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Selecione o fornecedor" />
              </Select.Trigger>
              <Select.Content>
                {query.data.suppliers.map((item) => (
                  <Select.Item key={item.id} value={item.id}>
                    {item.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div>
            <Text>Produto do catálogo</Text>
            <Select
              value={offer.product_id}
              onValueChange={(value) => {
                setOffer({ ...offer, product_id: value });
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Selecione o produto" />
              </Select.Trigger>
              <Select.Content>
                {query.data.products.map((item) => (
                  <Select.Item key={item.id} value={item.id}>
                    {item.title}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          {(
            [
              ["SKU nacional", "supplier_product_id"],
              ["URL/referência HTTPS", "source_url"],
              ["Custo BRL", "unit_cost"],
              ["Estoque", "stock"],
              ["Prazo em dias", "delivery_days"],
              ["Origem (cidade/UF)", "origin"],
            ] as const
          ).map(([label, field]) => (
            <div key={field}>
              <Text>{label}</Text>
              <Input
                aria-label={label}
                placeholder={label}
                value={offer[field]}
                onChange={(event) => {
                  setOffer({ ...offer, [field]: event.target.value });
                }}
              />
            </div>
          ))}
          <div>
            <Text>Modo de envio</Text>
            <Select
              value={offer.shipping_mode}
              onValueChange={(value) => {
                setOffer({ ...offer, shipping_mode: value });
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="DOMESTIC_MANUAL">
                  Frete doméstico manual
                </Select.Item>
                <Select.Item value="PICKUP">Retirada</Select.Item>
                <Select.Item value="CARRIER_FUTURE">
                  Transportadora futura
                </Select.Item>
              </Select.Content>
            </Select>
          </div>
          <div>
            <Text>Rastreamento</Text>
            <Select
              value={offer.tracking}
              onValueChange={(value) => {
                setOffer({ ...offer, tracking: value });
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="true">Tracking suportado</Select.Item>
                <Select.Item value="false">Sem tracking</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <Button
            disabled={
              !offer.supplier_id ||
              !offer.product_id ||
              !offer.source_url ||
              !offer.unit_cost ||
              createOffer.isPending
            }
            onClick={() => {
              createOffer.mutate();
            }}
          >
            Registrar oferta
          </Button>
        </div>
        {createOffer.isError && (
          <ErrorState message={String(createOffer.error)} />
        )}
      </Container>
      <Container>
        <Heading level="h2">Ofertas Brasil</Heading>
        <div className="mt-4 grid gap-2">
          {query.data.offers.map((item) => (
            <div className="rounded border p-3" key={item.id}>
              <Text>
                <strong>{item.supplier?.name ?? item.id}</strong> ·{" "}
                {item.supplier_product_id}
              </Text>
              <Text>
                R$ {item.unit_cost} · estoque{" "}
                {item.availability_quantity ?? "não informado"} · {item.status}
              </Text>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
};
export const config = defineRouteConfig({ label: "ACHILLES · Estoque Brasil" });
export default BrazilStockPage;
