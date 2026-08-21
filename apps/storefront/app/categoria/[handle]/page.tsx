import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "../../../components/store/breadcrumb";
import { ProductCard } from "../../../components/store/product-card";
import {
  Container,
  EmptyState,
  SectionHeading,
} from "../../../components/ui/primitives";
import {
  canonicalCategoryHandle,
  taxonomyItem,
} from "../../../lib/catalog-taxonomy";
import { getPublicCatalog } from "../../../lib/commerce";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ disponibilidade?: string; preco?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = canonicalCategoryHandle(decodeSegment((await params).handle));
  const item = taxonomyItem(handle);
  if (!item) notFound();
  return {
    title: item.title,
    description: item.description,
    alternates: { canonical: `/categoria/${item.handle}` },
    openGraph: { title: item.title, description: item.description },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const handle = canonicalCategoryHandle(decodeSegment((await params).handle));
  const item = taxonomyItem(handle);
  if (!item) notFound();
  const catalog = await getPublicCatalog({ category: handle });
  const filters = await searchParams;
  const products = catalog.products.filter((product) => {
    if (filters.disponibilidade === "em-estoque" && !product.available)
      return false;
    if (filters.preco === "ate-200" && product.price.amount > 200) return false;
    return true;
  });

  return (
    <main id="conteudo" className="catalog-page">
      <Container>
        <Breadcrumb
          items={[{ label: "Início", href: "/" }, { label: item.title }]}
        />
        <SectionHeading
          level={1}
          eyebrow="Categoria"
          title={item.title}
          description={item.description}
        />
        <div
          className="subcategory-list"
          aria-label={`Subcategorias de ${item.title}`}
        >
          {item.subcategories.map((subcategory) => (
            <span key={subcategory}>{subcategory}</span>
          ))}
        </div>
        <form
          className="catalog-filters"
          method="get"
          aria-label="Filtros do catálogo"
        >
          <label>
            Disponibilidade
            <select
              name="disponibilidade"
              defaultValue={filters.disponibilidade ?? ""}
            >
              <option value="">Todos</option>
              <option value="em-estoque">Disponíveis</option>
            </select>
          </label>
          <label>
            Preço
            <select name="preco" defaultValue={filters.preco ?? ""}>
              <option value="">Qualquer preço</option>
              <option value="ate-200">Até R$ 200</option>
            </select>
          </label>
          <button className="button button--secondary" type="submit">
            Aplicar filtros
          </button>
        </form>
        {products.length === 0 ? (
          <EmptyState title="Seleção em preparação">
            Estamos preparando os primeiros produtos desta categoria.
          </EmptyState>
        ) : (
          <div className="product-grid catalog-grid">
            {products.map((product) => (
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
