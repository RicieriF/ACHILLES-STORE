import type { Metadata } from "next";
import { ProductCard } from "../../components/store/product-card";
import {
  Container,
  EmptyState,
  SectionHeading,
} from "../../components/ui/primitives";
import { getPublicCatalog } from "../../lib/commerce";

export const metadata: Metadata = {
  title: "Busca",
  description: "Busque equipamentos no catálogo público da Achilles Store.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const catalog = query ? await getPublicCatalog({ query }) : null;

  return (
    <main id="conteudo" className="catalog-page search-page">
      <Container>
        <SectionHeading
          eyebrow="Busca"
          title={
            query ? `Resultados para “${query}”` : "Encontre seu equipamento"
          }
          description={
            query && catalog
              ? `${catalog.products.length} ${catalog.products.length === 1 ? "resultado público" : "resultados públicos"}.`
              : "Pesquise por título, descrição ou categoria."
          }
        />
        {!query ? (
          <EmptyState title="Digite um termo de busca">
            Use a busca no cabeçalho para começar.
          </EmptyState>
        ) : catalog?.products.length === 0 ? (
          <EmptyState title="Nenhum resultado">
            Tente um termo mais geral ou navegue pelas categorias disponíveis.
          </EmptyState>
        ) : (
          <div className="product-grid catalog-grid">
            {catalog?.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
