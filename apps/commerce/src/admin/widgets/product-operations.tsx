import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type {
  AdminProduct,
  DetailWidgetProps,
} from "@medusajs/framework/types";
import { Badge, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../components/page-state";
import {
  attentionLabels,
  money,
  type OperationalProduct,
} from "../lib/operations";
import { sdk } from "../lib/sdk";

const ProductOperationsWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const query = useQuery({
    queryKey: ["product-operations", data.id],
    queryFn: () =>
      sdk.client.fetch<{ product: OperationalProduct }>(
        `/admin/achilles/operations/catalog/${data.id}`,
      ),
  });
  if (query.isPending)
    return (
      <Container>
        <LoadingState />
      </Container>
    );
  if (query.isError)
    return (
      <Container>
        <ErrorState message={String(query.error)} />
      </Container>
    );
  const product = query.data.product;
  return (
    <Container className="divide-y p-0" data-testid="product-operations-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Operação ACHILLES</Heading>
          <Text className="text-ui-fg-subtle">
            Leitura consolidada; nenhuma aprovação automática.
          </Text>
        </div>
        <Badge color={product.attention.length ? "orange" : "green"}>
          {product.operationalStatus}
        </Badge>
      </div>
      <div className="grid gap-4 px-6 py-4 md:grid-cols-4">
        <Section
          title="Comercial"
          lines={[
            `Venda: ${money(product.retailPrice)}`,
            `Landed cost: ${money(product.landedCost)}`,
            `Margem: ${product.marginPercent === null ? "Não calculada" : `${String(product.marginPercent)}%`}`,
            `Readiness: ${product.commercialReadiness}`,
          ]}
        />
        <Section
          title="Fornecedor"
          lines={[
            product.supplier ?? "Não vinculado",
            `Ofertas: ${String(product.offerCount)}`,
            `Disponibilidade: ${product.availability ?? "Não informada"}`,
            `Sync: ${product.lastSyncAt ? new Date(product.lastSyncAt).toLocaleString("pt-BR") : "Nunca"}`,
          ]}
        />
        <Section
          title="Compliance"
          lines={[
            product.compliance,
            ...product.attention.map((reason) => attentionLabels[reason]),
          ]}
        />
        <Section
          title="Publicação"
          lines={[
            `Medusa: ${product.status}`,
            product.status === "published"
              ? "Publicado no core"
              : "Requer fluxo humano",
            product.origin ? "Origem disponível" : "Sem URL de origem",
          ]}
        />
      </div>
      {product.offerCount > 1 && (
        <div className="px-6 py-4">
          <a
            className="text-ui-fg-interactive"
            href="/app/achilles-products-suppliers"
          >
            Comparar {product.offerCount} ofertas vinculadas
          </a>
        </div>
      )}
    </Container>
  );
};
const Section = ({ title, lines }: { title: string; lines: string[] }) => (
  <div>
    <Heading level="h3">{title}</Heading>
    <div className="mt-2 grid gap-1">
      {lines.map((line, index) => (
        <Text className="text-ui-fg-subtle" key={`${line}-${String(index)}`}>
          {line}
        </Text>
      ))}
    </div>
  </div>
);
export const config = defineWidgetConfig({ zone: "product.details" });
export default ProductOperationsWidget;
