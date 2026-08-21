import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text } from "@medusajs/ui";

const tools = [
  ["Fornecedores", "/app/achilles-suppliers", "Cadastro e ofertas"],
  ["Catálogo CJ", "/app/achilles-cj-catalog", "Busca e consulta do provider"],
  [
    "Catálogo Alibaba",
    "/app/achilles-alibaba-catalog",
    "Foundation Open Platform",
  ],
  ["Integrações", "/app/achilles-integrations", "Status e health técnico"],
  ["Extensões", "/app/achilles-extensions", "Serviços opcionais"],
  ["Compliance", "/app/achilles-compliance", "Revisões e bloqueios"],
  ["Estoque Brasil", "/app/achilles-brazil-stock", "Operação nacional"],
  ["Private Label", "/app/achilles-private-label", "Branding e fornecedores"],
  ["Logística", "/app/achilles-logistics", "Cotações e roteamento"],
  ["Pagamentos", "/app/achilles-payments", "Diagnóstico do provider"],
  [
    "Produtos e fornecedores",
    "/app/achilles-products-suppliers",
    "Vínculos comerciais internos",
  ],
] as const;

const AdvancedPage = () => (
  <div className="flex flex-col gap-y-3" data-testid="advanced-page">
    <Container>
      <Heading level="h1">Avançado</Heading>
      <Text className="mt-2 text-ui-fg-subtle">
        Ferramentas técnicas preservadas para configuração, diagnóstico e
        operações excepcionais.
      </Text>
    </Container>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tools.map(([label, href, detail]) => (
        <a href={href} key={href}>
          <Container className="h-full transition-colors hover:bg-ui-bg-subtle">
            <Heading level="h2">{label}</Heading>
            <Text className="mt-2 text-ui-fg-subtle">{detail}</Text>
          </Container>
        </a>
      ))}
    </div>
  </div>
);

export const config = defineRouteConfig({ label: "AVANÇADO", rank: 90 });
export default AdvancedPage;
