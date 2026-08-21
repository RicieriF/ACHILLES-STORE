import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/page-state";
import {
  attentionLabels,
  money,
  type DashboardData,
} from "../../lib/operations";
import { sdk } from "../../lib/sdk";

const metricLabels: Array<[keyof DashboardData["today"], string]> = [
  ["sales", "Vendas hoje"],
  ["orders", "Pedidos hoje"],
  ["averageTicket", "Ticket médio"],
  ["estimatedProfit", "Lucro estimado"],
  ["pendingPayments", "Pagamentos pendentes"],
  ["awaitingSupplier", "Aguardando fornecedor"],
  ["exceptions", "Exceções abertas"],
];
const catalogLabels: Array<[keyof DashboardData["catalog"], string]> = [
  ["total", "Total"],
  ["published", "Publicados"],
  ["drafts", "Rascunhos"],
  ["withoutPrice", "Sem preço"],
  ["withoutStock", "Sem estoque"],
  ["withoutSupplier", "Sem fornecedor"],
  ["compliancePending", "Compliance pendente"],
  ["blocked", "Bloqueados"],
];

const AchillesHome = () => {
  const query = useQuery({
    queryKey: ["achilles-operations-dashboard"],
    queryFn: () =>
      sdk.client.fetch<DashboardData>("/admin/achilles/operations/dashboard"),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  const data = query.data;
  return (
    <div className="flex flex-col gap-y-3" data-testid="operations-dashboard">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1">Central de Operações Dropshipping</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              Situação real do catálogo, fornecedores e pedidos. Valores
              ausentes permanecem explícitos.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/app/achilles-catalog">
              <Button>Novo produto</Button>
            </a>
            <a href="/app/achilles-imports">
              <Button variant="secondary">Importar por URL</Button>
            </a>
            <a href="/app/achilles-suppliers">
              <Button variant="secondary">Fornecedores</Button>
            </a>
          </div>
        </div>
      </Container>
      <Container>
        <Heading level="h2">Hoje</Heading>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {metricLabels.map(([key, label]) => (
            <div className="rounded-lg border p-3" key={key}>
              <Text className="text-ui-fg-subtle">{label}</Text>
              <Text className="mt-1 text-xl font-semibold">
                {["sales", "averageTicket", "estimatedProfit"].includes(key)
                  ? money(data.today[key])
                  : data.today[key]}
              </Text>
            </div>
          ))}
        </div>
      </Container>
      <div className="grid gap-3 xl:grid-cols-2">
        <Container>
          <div className="flex items-center justify-between">
            <Heading level="h2">Catálogo</Heading>
            <a className="text-ui-fg-interactive" href="/app/achilles-catalog">
              Abrir catálogo
            </a>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {catalogLabels.map(([key, label]) => (
              <div className="rounded border p-3" key={key}>
                <Text className="text-ui-fg-subtle">{label}</Text>
                <Text className="text-lg font-semibold">
                  {data.catalog[key]}
                </Text>
              </div>
            ))}
          </div>
        </Container>
        <Container>
          <Heading level="h2">Fornecedores</Heading>
          <div className="mt-4 grid gap-2">
            {data.providers.map((provider) => (
              <div
                className="flex items-center justify-between rounded border p-3"
                key={provider.provider}
              >
                <div>
                  <Text className="font-medium">{provider.provider}</Text>
                  <Text className="text-ui-fg-subtle">
                    {provider.products} produtos · {provider.offers} ofertas ·{" "}
                    {provider.problems} problemas
                  </Text>
                </div>
                <Badge
                  color={
                    provider.health === "HEALTHY"
                      ? "green"
                      : provider.health === "DISABLED"
                        ? "grey"
                        : "orange"
                  }
                >
                  {provider.status}
                </Badge>
              </div>
            ))}
          </div>
        </Container>
      </div>
      <Container>
        <Heading level="h2">Precisa de atenção</Heading>
        {!data.alerts.length ? (
          <EmptyState>Nenhuma pendência derivada dos dados atuais.</EmptyState>
        ) : (
          <div className="mt-4 divide-y">
            {data.alerts.map((alert, index) => (
              <a
                className="flex items-center justify-between gap-3 py-3"
                href={`/app/products/${alert.productId}`}
                key={`${alert.productId}-${alert.reason}-${String(index)}`}
              >
                <div>
                  <Text className="font-medium">{alert.product}</Text>
                  <Text className="text-ui-fg-subtle">
                    {attentionLabels[alert.reason]}
                  </Text>
                </div>
                <Badge color={alert.severity === "BLOCKING" ? "red" : "orange"}>
                  {alert.severity}
                </Badge>
              </a>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({ label: "VISÃO GERAL · Operações" });
export default AchillesHome;
