import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "../../../components/store/breadcrumb";
import { ProductCard } from "../../../components/store/product-card";
import {
  Container,
  EmptyState,
  SectionHeading,
} from "../../../components/ui/primitives";
import { getPublicCatalog } from "../../../lib/commerce";

type CategoryPageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { handle: rawHandle } = await params;
  const handle = decodeSegment(rawHandle);
  const catalog = await getPublicCatalog({ category: handle }).catch(
    () => null,
  );
  const category = catalog?.categories.find((item) => item.handle === handle);
  if (!category) notFound();
  return {
    title: category.title,
    description:
      category.description ??
      `Equipamentos ${category.title} selecionados pela Achilles Store.`,
    alternates: { canonical: `/categoria/${category.handle}` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { handle: rawHandle } = await params;
  const handle = decodeSegment(rawHandle);
  const catalog = await getPublicCatalog({ category: handle });
  const category = catalog.categories.find((item) => item.handle === handle);
  if (!category) notFound();

  return (
    <main id="conteudo" className="catalog-page">
      <Container>
        <Breadcrumb
          items={[{ label: "Início", href: "/" }, { label: category.title }]}
        />
        <SectionHeading
          level={1}
          eyebrow="Categoria"
          title={category.title}
          description={
            category.description ??
            `${category.productCount} ${category.productCount === 1 ? "produto aprovado" : "produtos aprovados"}.`
          }
        />
        {catalog.products.length === 0 ? (
          <EmptyState title="Nenhum produto disponível">
            Esta categoria não possui itens públicos neste momento.
          </EmptyState>
        ) : (
          <div className="product-grid catalog-grid">
            {catalog.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
