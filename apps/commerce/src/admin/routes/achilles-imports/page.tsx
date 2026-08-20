import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Heading, Text } from "@medusajs/ui";

const ImportsPage = () => (
  <Container>
    <div className="flex items-center gap-2">
      <Heading level="h1">Importações</Heading>
      <Badge color="grey">Indisponível</Badge>
    </div>
    <Text className="mt-4">
      Importação de produtos Alibaba ainda não configurada.
    </Text>
    <Text className="mt-2 text-ui-fg-subtle">
      A funcionalidade será habilitada somente quando o SupplierConnector
      possuir autorização e capacidades validadas. Não há scraping,
      sincronização, pedido ou pagamento ativo.
    </Text>
  </Container>
);

export const config = defineRouteConfig({ label: "ACHILLES · Importações" });
export default ImportsPage;
