import Link from "next/link";
import { Container, EmptyState } from "../components/ui/primitives";

export default function NotFound() {
  return (
    <main id="conteudo" className="catalog-page">
      <Container>
        <EmptyState title="Página não encontrada">
          O produto pode ter sido removido ou ainda não está liberado para o
          catálogo público.
        </EmptyState>
        <Link href="/" className="button button--primary">
          Voltar para o início
        </Link>
      </Container>
    </main>
  );
}
