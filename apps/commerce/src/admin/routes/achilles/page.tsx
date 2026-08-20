import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text } from "@medusajs/ui";

const AchillesHome = () => (
  <Container>
    <Heading level="h1">ACHILLES STORE</Heading>
    <Text className="mt-2 text-ui-fg-subtle">
      Administração de fornecedores, private label e compliance.
    </Text>
    <Text className="mt-4">
      Use as áreas no menu para operar o catálogo de fornecimento. Integrações
      Alibaba permanecem desativadas.
    </Text>
  </Container>
);

export const config = defineRouteConfig({ label: "ACHILLES STORE" });
export default AchillesHome;
