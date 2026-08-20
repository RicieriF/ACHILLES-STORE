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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type Provider = {
  provider: string;
  health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "DISABLED";
  capabilities: string[];
  reason?: string;
};
type Product = {
  id: string;
  title: string;
  variants: Array<{ id: string; title: string }>;
};
type LogisticsData = {
  providers: Provider[];
  flags: Record<string, boolean>;
  products: Product[];
  recentQuotes: Array<{ id: string; provider: string; status: string }>;
};
type Candidate = {
  quoteId: string;
  supplierOfferId: string;
  supplierUnitCostBrl: string;
  shippingCostBrl: string;
  deliveredSupplierCostBrl: string;
  estimatedMinimumDays: number;
  estimatedMaximumDays: number;
  privateLabelSupported: boolean;
  isPrimary: boolean;
  supplierName: string;
};
type Simulation = {
  routing: { recommended: Candidate | null; reason: string };
  candidates: Candidate[];
};

const LogisticsPage = () => {
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [postalCode, setPostalCode] = useState("01310-100");
  const query = useQuery({
    queryKey: ["achilles-logistics"],
    queryFn: () =>
      sdk.client.fetch<LogisticsData>("/admin/achilles/logistics/providers"),
  });
  const variants = useMemo(
    () =>
      query.data?.products.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          label: `${product.title} · ${variant.title}`,
        })),
      ) ?? [],
    [query.data],
  );
  const simulation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<Simulation>("/admin/achilles/logistics/simulator", {
        method: "POST",
        body: { variantId, quantity: Number(quantity), postalCode },
      }),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Logística</Heading>
        <Text className="text-ui-fg-subtle">
          Providers, capacidades e cotações transacionais. Nenhum pedido ou
          pagamento é executado.
        </Text>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {query.data.providers.map((provider) => (
            <div className="rounded border p-3" key={provider.provider}>
              <div className="flex items-center justify-between">
                <Heading level="h2">{provider.provider}</Heading>
                <Badge
                  color={
                    provider.health === "HEALTHY"
                      ? "green"
                      : provider.health === "DISABLED"
                        ? "grey"
                        : "orange"
                  }
                >
                  {provider.health}
                </Badge>
              </div>
              <Text className="mt-2 text-ui-fg-subtle">{provider.reason}</Text>
              <Text className="mt-2">
                {provider.capabilities.join(" · ") ||
                  "Sem capacidades confirmadas"}
              </Text>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {Object.entries(query.data.flags).map(([flag, enabled]) => (
            <Text key={flag}>
              {flag}: <strong>{enabled ? "ON" : "OFF"}</strong>
            </Text>
          ))}
        </div>
      </Container>
      <Container>
        <Heading level="h2">Simulador interno</Heading>
        <Text className="text-ui-fg-subtle">
          Produto, variante, quantidade e CEP com custos internos rastreáveis.
        </Text>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Select value={variantId} onValueChange={setVariantId}>
            <Select.Trigger>
              <Select.Value placeholder="Produto e variante" />
            </Select.Trigger>
            <Select.Content>
              {variants.map((variant) => (
                <Select.Item key={variant.id} value={variant.id}>
                  {variant.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            aria-label="Quantidade"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
            }}
          />
          <Input
            aria-label="CEP"
            value={postalCode}
            onChange={(event) => {
              setPostalCode(event.target.value);
            }}
          />
          <Button
            disabled={!variantId || simulation.isPending}
            onClick={() => {
              simulation.mutate();
            }}
          >
            {simulation.isPending ? "Cotando…" : "COTAR"}
          </Button>
        </div>
        {simulation.isError && (
          <ErrorState message={String(simulation.error)} />
        )}
      </Container>
      {simulation.data && (
        <Container>
          <Heading level="h2">Resultado</Heading>
          <Text>{simulation.data.routing.reason}</Text>
          <div className="mt-4 grid gap-3">
            {simulation.data.candidates.map((candidate) => (
              <div className="rounded border p-3" key={candidate.quoteId}>
                <div className="flex items-center justify-between">
                  <Text>
                    <strong>{candidate.supplierName}</strong>
                  </Text>
                  {simulation.data.routing.recommended?.quoteId ===
                    candidate.quoteId && (
                    <Badge color="green">RECOMENDADO</Badge>
                  )}
                </div>
                <Text>
                  Produto: R$ {candidate.supplierUnitCostBrl} · Frete: R${" "}
                  {candidate.shippingCostBrl} · Delivered cost: R${" "}
                  {candidate.deliveredSupplierCostBrl}
                </Text>
                <Text>
                  Prazo: {candidate.estimatedMinimumDays}–
                  {candidate.estimatedMaximumDays} dias · Private label:{" "}
                  {candidate.privateLabelSupported ? "sim" : "não"} · Principal:{" "}
                  {candidate.isPrimary ? "sim" : "não"}
                </Text>
              </div>
            ))}
          </div>
        </Container>
      )}
      <Container>
        <Heading level="h2">Últimas cotações</Heading>
        {query.data.recentQuotes.length ? (
          query.data.recentQuotes.map((quote) => (
            <Text key={quote.id}>
              {quote.provider} · {quote.status} · {quote.id}
            </Text>
          ))
        ) : (
          <Text>Nenhuma cotação registrada.</Text>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({ label: "ACHILLES · Logística" });
export default LogisticsPage;
