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
  humanStatus,
  money,
  type DashboardData,
} from "../../lib/operations";
import { sdk } from "../../lib/sdk";

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
            <Heading level="h1">Início</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              O essencial para importar, publicar e acompanhar suas vendas.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/app/achilles-imports">
              <Button>IMPORTAR PRODUTO</Button>
            </a>
            <a href="/app/achilles-catalog">
              <Button variant="secondary">VER PRODUTOS</Button>
            </a>
            <a href="/app/achilles-orders">
              <Button variant="secondary">VER PEDIDOS</Button>
            </a>
          </div>
        </div>
      </Container>
      <Container>
        <Heading level="h2">Resumo</Heading>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Produtos publicados", data.catalog.published],
            ["Rascunhos", data.catalog.drafts],
            ["Pedidos novos", data.today.orders],
            ["Pedidos pendentes", data.today.awaitingSupplier],
            ["Vendas", money(data.today.sales)],
            ["Precisam de atenção", data.alerts.length],
          ].map(([label, value]) => (
            <div className="rounded-lg border p-3" key={label}>
              <Text className="text-ui-fg-subtle">{label}</Text>
              <Text className="mt-1 text-xl font-semibold">{value}</Text>
            </div>
          ))}
        </div>
      </Container>
      <div className="grid gap-3">
        <Container>
          <div className="flex items-center justify-between">
            <Heading level="h2">Catálogo</Heading>
            <a className="text-ui-fg-interactive" href="/app/achilles-catalog">
              Ver produtos
            </a>
          </div>
          <Text className="mt-3 text-ui-fg-subtle">
            {data.catalog.withoutPrice} sem preço ·{" "}
            {data.catalog.withoutSupplier} sem fornecedor ·{" "}
            {data.catalog.compliancePending} pendentes de revisão
          </Text>
        </Container>
      </div>
      <Container>
        <Heading level="h2">Precisa de atenção</Heading>
        {!data.alerts.length ? (
          <EmptyState>Tudo em dia — nada para resolver.</EmptyState>
        ) : (
          <div className="mt-4 divide-y">
            {data.alerts.map((alert) => (
              <div
                className="flex items-center justify-between gap-3 py-3"
                key={alert.productId}
              >
                <div>
                  <Text className="font-medium">{alert.product}</Text>
                  <Text className="text-ui-fg-subtle">
                    {attentionLabels[alert.reason]}
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    color={alert.severity === "BLOCKING" ? "red" : "orange"}
                  >
                    {humanStatus(alert.severity)}
                  </Badge>
                  <a
                    href={`/app/achilles-catalog?q=${encodeURIComponent(alert.product)}`}
                  >
                    <Button variant="secondary" size="small">
                      COMPLETAR
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({ label: "INÍCIO", rank: 10 });
export default AchillesHome;
