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
  const configured = (key: string) =>
    query.data.secrets[key] === "Configurado ✓";
  const groups = [
    {
      title: "Pagamentos",
      ready: configured("mercadoPagoAccessToken"),
      detail: "Mercado Pago para Pix e cartão",
    },
    {
      title: "Entrega",
      ready: true,
      detail: String(query.data.store.defaultShippingPolicy),
    },
    {
      title: "Fornecedores",
      ready: configured("cjApiKey") || configured("alibabaAppKey"),
      detail: "CJ, Alibaba e fornecedores manuais",
    },
    {
      title: "E-mail",
      ready: configured("resendApiKey"),
      detail: "Notificações ao cliente",
    },
    {
      title: "Arquivos",
      ready: true,
      detail: "Imagens e documentos do catálogo",
    },
  ];
  return (
    <div className="flex flex-col gap-y-3" data-testid="settings-page">
      <Container>
        <Heading level="h1">ACHILLES · Configurações</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Visão simples da loja e dos serviços necessários para operar.
        </Text>
        <Badge className="mt-3" color="blue">
          {query.data.environment}
        </Badge>
      </Container>
      <Container>
        <Heading level="h2">Loja</Heading>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <Text>
            Nome: <strong>{String(query.data.store.name)}</strong>
          </Text>
          <Text>
            Moeda: <strong>{String(query.data.store.currency)}</strong>
          </Text>
          <Text>
            País: <strong>{String(query.data.store.country)}</strong>
          </Text>
          <Text>
            E-mail de suporte:{" "}
            <strong>
              {String(query.data.store.supportEmail ?? "Não informado")}
            </strong>
          </Text>
          <Text>
            Telefone:{" "}
            <strong>
              {String(query.data.store.supportPhone ?? "Não informado")}
            </strong>
          </Text>
          <Text>
            Pedidos ao fornecedor: <strong>manual</strong>
          </Text>
        </div>
      </Container>
      <Container>
        <Heading level="h2">Serviços</Heading>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <div className="rounded border p-3" key={group.title}>
              <div className="flex items-center justify-between gap-2">
                <Heading level="h3">{group.title}</Heading>
                <Badge color={group.ready ? "green" : "orange"}>
                  {group.ready ? "Disponível" : "Configuração pendente"}
                </Badge>
              </div>
              <Text className="mt-1 text-ui-fg-subtle">{group.detail}</Text>
            </div>
          ))}
        </div>
        <Text className="mt-4 text-ui-fg-subtle">
          Credenciais e recursos avançados são administrados em Integrações e
          Extensões. Nenhum segredo é exibido aqui.
        </Text>
      </Container>
    </div>
  );
};
export const config = defineRouteConfig({ label: "CONFIGURAÇÕES" });
export default SettingsPage;
