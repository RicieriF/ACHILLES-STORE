import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type Extension = {
  id: string;
  name: string;
  category: string;
  status: "INSTALLED" | "CONFIGURED" | "NOT_CONFIGURED" | "DISABLED";
  detail: string;
  configured: Record<string, boolean>;
};
type Data = { extensions: Extension[] };
const color = (status: Extension["status"]): "green" | "orange" | "grey" =>
  status === "CONFIGURED" || status === "INSTALLED"
    ? "green"
    : status === "NOT_CONFIGURED"
      ? "orange"
      : "grey";

const ExtensionsPage = () => {
  const query = useQuery({
    queryKey: ["achilles-extensions"],
    queryFn: () =>
      sdk.client.fetch<Data>("/admin/achilles/operations/extensions"),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3" data-testid="extensions-page">
      <Container>
        <Heading level="h1">Extensões e Serviços</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Configuração sanitizada. “Configurado” não significa conexão saudável
          sem um health check real.
        </Text>
      </Container>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {query.data.extensions.map((extension) => (
          <Container key={extension.id}>
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-ui-fg-subtle">{extension.category}</Text>
                <Heading level="h2">{extension.name}</Heading>
              </div>
              <Badge color={color(extension.status)}>{extension.status}</Badge>
            </div>
            <Text className="mt-3">{extension.detail}</Text>
            <div className="mt-4 flex flex-wrap gap-1">
              {Object.entries(extension.configured).map(([key, value]) => (
                <Badge color={value ? "green" : "grey"} key={key}>
                  {key}: {value ? "Configurado" : "Ausente"}
                </Badge>
              ))}
            </div>
          </Container>
        ))}
      </div>
    </div>
  );
};
export const config = defineRouteConfig({});
export default ExtensionsPage;
