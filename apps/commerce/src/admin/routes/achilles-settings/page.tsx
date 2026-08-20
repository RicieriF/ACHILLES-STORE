import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";
type Data = {
  environment: string;
  store: Record<string, string | boolean | null>;
  secrets: Record<string, string>;
  flags: Record<string, boolean>;
  readOnly: true;
};
const SettingsPage = () => {
  const query = useQuery({
    queryKey: ["achilles-settings"],
    queryFn: () => sdk.client.fetch<Data>("/admin/achilles/settings"),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3" data-testid="settings-page">
      <Container>
        <Heading level="h1">ACHILLES · Configurações</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Configuração operacional somente leitura via ENV/secret store.
          Segredos nunca são editáveis nesta tela.
        </Text>
        <Badge className="mt-3" color="blue">
          {query.data.environment}
        </Badge>
      </Container>
      <Container>
        <Heading level="h2">Loja</Heading>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {Object.entries(query.data.store).map(([key, value]) => (
            <Text key={key}>
              {key}: <strong>{String(value ?? "Não configurado")}</strong>
            </Text>
          ))}
        </div>
      </Container>
      <Container>
        <Heading level="h2">Segredos</Heading>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {Object.entries(query.data.secrets).map(([key, value]) => (
            <Text key={key}>
              {key}: <strong>{value}</strong>
            </Text>
          ))}
        </div>
      </Container>
      <Container>
        <Heading level="h2">Feature Flags</Heading>
        <Text className="text-ui-fg-subtle">
          Alterações exigem atualização segura do ambiente e novo deploy.
        </Text>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {Object.entries(query.data.flags).map(([key, value]) => (
            <Text key={key}>
              {key}:{" "}
              <Badge color={value ? "green" : "grey"}>
                {value ? "ON" : "OFF"}
              </Badge>
            </Text>
          ))}
        </div>
      </Container>
    </div>
  );
};
export const config = defineRouteConfig({ label: "ACHILLES · Configurações" });
export default SettingsPage;
