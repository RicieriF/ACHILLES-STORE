import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type CJEnvelope = {
  products: unknown;
  source: string;
};

const CJCatalogPage = () => {
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const query = useQuery({
    queryKey: ["cj-products", keyword],
    queryFn: () =>
      sdk.client.fetch<CJEnvelope>("/admin/achilles/integrations/cj/products", {
        query: { keyword, page: 1, size: 20 },
      }),
    enabled: keyword.length >= 2,
  });
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">ACHILLES · CJ CATÁLOGO</Heading>
        <Text className="text-ui-fg-subtle">
          Pesquisa autorizada na API V2. Salvar sempre cria DRAFT; nunca publica
          ou envia pedido.
        </Text>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Palavra-chave"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
          <Button
            onClick={() => {
              setKeyword(draft.trim());
            }}
            disabled={draft.trim().length < 2}
          >
            BUSCAR
          </Button>
        </div>
      </Container>
      {query.isPending && keyword ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={String(query.error)} />
      ) : query.data ? (
        <Container>
          <Heading level="h2">Resultado CJ</Heading>
          <Text className="mt-2">
            Resposta oficial recebida. Detalhes, variantes, estoque e frete
            permanecem dados do provedor e devem ser revisados antes da
            importação.
          </Text>
          <pre className="mt-4 max-h-96 overflow-auto rounded bg-ui-bg-subtle p-3 text-xs">
            {JSON.stringify(query.data.products, null, 2)}
          </pre>
        </Container>
      ) : (
        <Container>
          <Text>Informe uma palavra-chave para consultar produtos.</Text>
        </Container>
      )}
    </div>
  );
};

export const config = defineRouteConfig({ label: "ACHILLES · CJ Catálogo" });
export default CJCatalogPage;
