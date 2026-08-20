"use client";

import { Button, Container, ErrorState } from "../components/ui/primitives";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="conteudo" className="catalog-page">
      <Container>
        <ErrorState>
          O catálogo não respondeu. Verifique sua conexão e tente novamente.
        </ErrorState>
        <Button onClick={reset}>Tentar novamente</Button>
      </Container>
    </main>
  );
}
