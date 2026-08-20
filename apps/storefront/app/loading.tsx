import { Container, Skeleton } from "../components/ui/primitives";

export default function Loading() {
  return (
    <main id="conteudo" className="catalog-page" aria-busy="true">
      <Container>
        <Skeleton className="skeleton--heading" />
        <div className="product-grid catalog-grid">
          <Skeleton className="skeleton--card" />
          <Skeleton className="skeleton--card" />
          <Skeleton className="skeleton--card" />
        </div>
      </Container>
    </main>
  );
}
