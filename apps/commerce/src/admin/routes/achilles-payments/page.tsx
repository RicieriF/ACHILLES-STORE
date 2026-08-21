import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type Payment = {
  id: string;
  checkout_session_id: string;
  provider: string;
  provider_order_id: string | null;
  method: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};
type Data = {
  payments: Payment[];
  capabilities: { health: string; testMode: boolean };
  refundsEnabled: false;
  supplierOrderAuthorized: false;
};

const PaymentsPage = () => {
  const query = useQuery({
    queryKey: ["achilles-payments"],
    queryFn: () => sdk.client.fetch<Data>("/admin/achilles/payments"),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Pagamentos</Heading>
        <Text className="text-ui-fg-subtle">
          Payment Intents do cliente. Refund e pedido ao fornecedor permanecem
          desativados.
        </Text>
        <div className="mt-3 flex gap-2">
          <Badge
            color={
              query.data.capabilities.health === "HEALTHY" ? "green" : "grey"
            }
          >
            {query.data.capabilities.health}
          </Badge>
          {query.data.capabilities.testMode && (
            <Badge color="orange">TEST</Badge>
          )}
        </div>
      </Container>
      <Container>
        {query.data.payments.length === 0 ? (
          <Text>Nenhuma tentativa de pagamento.</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>Método</Table.HeaderCell>
                <Table.HeaderCell>Valor</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Provider order</Table.HeaderCell>
                <Table.HeaderCell>Checkout</Table.HeaderCell>
                <Table.HeaderCell>Criado</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {query.data.payments.map((payment) => (
                <Table.Row key={payment.id}>
                  <Table.Cell>{payment.id}</Table.Cell>
                  <Table.Cell>{payment.method}</Table.Cell>
                  <Table.Cell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: payment.currency,
                    }).format(Number(payment.amount))}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={
                        payment.status === "PAID"
                          ? "green"
                          : payment.status === "FAILED"
                            ? "red"
                            : "orange"
                      }
                    >
                      {payment.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{payment.provider_order_id ?? "—"}</Table.Cell>
                  <Table.Cell>{payment.checkout_session_id}</Table.Cell>
                  <Table.Cell>
                    {new Date(payment.created_at).toLocaleString("pt-BR")}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
    </div>
  );
};
export const config = defineRouteConfig({});
export default PaymentsPage;
