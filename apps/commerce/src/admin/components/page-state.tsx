import { Alert, Container, Text } from "@medusajs/ui";

export const LoadingState = () => (
  <Container>
    <Text>Carregando dados administrativos…</Text>
  </Container>
);

export const ErrorState = ({ message }: { message: string }) => (
  <Alert variant="error" dismissible={false}>
    {message.includes("401")
      ? "Autenticação administrativa necessária."
      : message}
  </Alert>
);

export const EmptyState = ({ children }: { children: string }) => (
  <Container>
    <Text className="text-ui-fg-subtle">{children}</Text>
  </Container>
);
