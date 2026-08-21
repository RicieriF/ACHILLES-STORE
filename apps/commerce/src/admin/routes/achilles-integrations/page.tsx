import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type Status =
  | "CONNECTED"
  | "CONFIGURED"
  | "DISABLED"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED";
type Integration = {
  id: string;
  name: string;
  section: string;
  status: Status;
  health: string;
  detail: string;
  configured: Record<string, boolean>;
  capabilities: Record<string, boolean>;
};
type Data = {
  integrations: Integration[];
  health: Array<{ service: string; status: string; detail: string }>;
  webhookUrl: string | null;
  config: { environment: string };
};
const color = (status: string): "green" | "orange" | "red" | "grey" =>
  status === "CONNECTED" || status === "CONFIGURED" || status === "HEALTHY"
    ? "green"
    : status === "UNAVAILABLE"
      ? "red"
      : status === "DEGRADED" || status === "NOT_CONFIGURED"
        ? "orange"
        : "grey";

const IntegrationsPage = () => {
  const query = useQuery({
    queryKey: ["achilles-integrations"],
    queryFn: () => sdk.client.fetch<Data>("/admin/achilles/integrations"),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  const sections = ["Fornecedores", "Pagamentos", "Logística", "Comunicação"];
  return (
    <div className="flex flex-col gap-y-3" data-testid="integration-hub">
      <Container>
        <Heading level="h1">ACHILLES · Integrações</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Estado operacional real, capacidades e configuração sanitizada.
          Ambiente: {query.data.config.environment}.
        </Text>
        <Text className="mt-2">
          Webhook Mercado Pago:{" "}
          {query.data.webhookUrl ?? "Defina PUBLIC_BASE_URL"}
        </Text>
      </Container>
      {sections.map((section) => (
        <Container key={section}>
          <Heading level="h2">{section}</Heading>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {query.data.integrations
              .filter((item) => item.section === section)
              .map((item) => (
                <div
                  className="rounded border p-4"
                  key={item.id}
                  data-testid={`integration-${item.id}`}
                >
                  <div className="flex items-center justify-between">
                    <Heading level="h2">{item.name}</Heading>
                    <Badge color={color(item.status)}>{item.status}</Badge>
                  </div>
                  <Text className="mt-2 text-ui-fg-subtle">{item.detail}</Text>
                  <div className="mt-3 grid gap-1">
                    {Object.entries(item.configured).map(([name, value]) => (
                      <Text key={name}>
                        {name}: {value ? "Configurado ✓" : "Não configurado"}
                      </Text>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(item.capabilities).map(
                      ([name, enabled]) => (
                        <Badge key={name} color={enabled ? "green" : "grey"}>
                          {name}: {enabled ? "ON" : "OFF"}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Container>
      ))}
      <Container data-testid="health-dashboard">
        <Heading level="h2">Sistema · Health</Heading>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {query.data.health.map((item) => (
            <div
              className="flex items-center justify-between rounded border p-3"
              key={item.service}
            >
              <div>
                <Text>
                  <strong>{item.service}</strong>
                </Text>
                <Text className="text-ui-fg-subtle">{item.detail}</Text>
              </div>
              <Badge color={color(item.status)}>{item.status}</Badge>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
};
export const config = defineRouteConfig({ label: "AVANÇADO · Integrações" });
export default IntegrationsPage;
