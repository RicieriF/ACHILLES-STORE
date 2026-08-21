import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import { sdk } from "../../lib/sdk";

type OrderSummary = {
  id: string;
  reference: string;
  status: string;
  total_paid: string;
  currency: string;
  customer_snapshot: { name: string; email: string };
  payment_status: string;
  gate_status: string;
  open_exceptions: number;
  created_at: string;
};
type OrderDetail = {
  order: OrderSummary & {
    items_snapshot: Array<{
      productTitle: string;
      variantTitle: string;
      quantity: number;
    }>;
    shipping_snapshot: Array<{ methodName: string }>;
  };
  plan: {
    status: string;
    approved_by: string | null;
    approved_at: string | null;
  } | null;
  groups: Array<{
    id: string;
    supplier_offer_id: string;
    provider: string;
    fulfillment_mode: string;
    routing_snapshot: {
      sourceCost: string;
      shippingCost: string;
      deliveredCost: string;
      currency: string;
      inventoryStatus: string;
    };
  }>;
  gate: {
    status: string;
    reasons: string[];
    changes: Array<{
      type: string;
      original: string;
      current: string;
      currency: string;
    }>;
    margin: { margin: string | null; marginPercent: string | null };
  };
  supplierOrders: Array<{
    id: string;
    status: string;
    provider: string;
    sandbox: boolean;
    expected_total: string;
  }>;
  tracking: Array<{
    status: string;
    carrier: string;
    tracking_number: string;
    sandbox: boolean;
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    message: string;
  }>;
  audit: Array<{ action: string; summary: string; created_at: string }>;
  realExecutionEnabled: false;
};
type Alternative = {
  offer_id: string;
  provider: string;
  availability: string;
  fulfillment_mode: string;
  unit_cost: string;
  currency: string;
  shipping_brl: string | null;
  estimated_min_days: number | null;
  estimated_max_days: number | null;
};

const OrdersPage = () => {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const list = useQuery({
    queryKey: ["achilles-orders"],
    queryFn: () =>
      sdk.client.fetch<{ orders: OrderSummary[] }>("/admin/achilles/orders"),
  });
  const detail = useQuery({
    queryKey: ["achilles-order", selected],
    queryFn: () => {
      if (!selected) throw new Error("Pedido não selecionado");
      return sdk.client.fetch<OrderDetail>(
        `/admin/achilles/orders/${selected}`,
      );
    },
    enabled: Boolean(selected),
  });
  const alternatives = useQuery({
    queryKey: ["achilles-order-alternatives", selected],
    queryFn: () => {
      if (!selected) throw new Error("Pedido não selecionado");
      return sdk.client.fetch<{ alternatives: Alternative[] }>(
        `/admin/achilles/orders/${selected}/alternatives`,
      );
    },
    enabled: Boolean(selected),
  });
  const action = useMutation({
    mutationFn: (input: { path: string; body: object }) =>
      sdk.client.fetch(input.path, { method: "POST", body: input.body }),
    onSuccess: async () => {
      setConfirmed(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["achilles-orders"] }),
        client.invalidateQueries({ queryKey: ["achilles-order", selected] }),
        client.invalidateQueries({
          queryKey: ["achilles-order-alternatives", selected],
        }),
      ]);
    },
  });
  if (list.isPending) return <LoadingState />;
  if (list.isError) return <ErrorState message={String(list.error)} />;
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Pedidos</Heading>
        <Text className="text-ui-fg-subtle">
          Pedidos pagos e ações pendentes. Pedido ao fornecedor: manual.
        </Text>
      </Container>
      <Container>
        {list.data.orders.length === 0 ? (
          <Text>Nenhum pedido pago.</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Número</Table.HeaderCell>
                <Table.HeaderCell>Data</Table.HeaderCell>
                <Table.HeaderCell>Cliente</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
                <Table.HeaderCell>Pagamento</Table.HeaderCell>
                <Table.HeaderCell>Fulfillment</Table.HeaderCell>
                <Table.HeaderCell>Exceções</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {list.data.orders.map((order) => (
                <Table.Row
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(order.id);
                  }}
                >
                  <Table.Cell>
                    <strong>{order.reference}</strong>
                  </Table.Cell>
                  <Table.Cell>
                    {new Date(order.created_at).toLocaleString("pt-BR")}
                  </Table.Cell>
                  <Table.Cell>
                    {order.customer_snapshot.name} ·{" "}
                    {order.customer_snapshot.email}
                  </Table.Cell>
                  <Table.Cell>
                    {money(order.total_paid, order.currency)}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="green">{order.payment_status}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={order.gate_status === "BLOCKED" ? "red" : "orange"}
                    >
                      {order.gate_status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{order.open_exceptions}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
      {selected &&
        (detail.isPending ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState message={String(detail.error)} />
        ) : (
          <>
            <Container>
              <Heading level="h2">{detail.data.order.reference}</Heading>
              <Text>
                Pagamento: {detail.data.order.payment_status} · Status:{" "}
                {detail.data.order.status}
              </Text>
              {detail.data.order.items_snapshot.map((item, index) => (
                <Text key={`${item.productTitle}-${String(index)}`}>
                  {item.quantity}× {item.productTitle} · {item.variantTitle}
                </Text>
              ))}
            </Container>
            <Container>
              <Heading level="h2">Validação do fornecedor</Heading>
              <div className="mt-2 flex gap-2">
                <Badge
                  color={
                    detail.data.gate.status === "APPROVAL_REQUIRED"
                      ? "orange"
                      : detail.data.gate.status === "APPROVED"
                        ? "green"
                        : "red"
                  }
                >
                  {detail.data.gate.status}
                </Badge>
                <Badge color="orange">Operação manual</Badge>
              </div>
              {detail.data.gate.reasons.map((reason) => (
                <Text key={reason}>{reason}</Text>
              ))}
              {detail.data.gate.changes.map((change) => (
                <Text key={change.type}>
                  <strong>
                    {change.type === "PRICE_CHANGED"
                      ? "Custo do fornecedor mudou desde a venda."
                      : "Frete mudou desde a venda."}
                  </strong>{" "}
                  {change.original} → {change.current} {change.currency}
                </Text>
              ))}
              <Text>
                Margem: {detail.data.gate.margin.margin ?? "desconhecida"} (
                {detail.data.gate.margin.marginPercent ?? "—"}%)
              </Text>
            </Container>
            <Container>
              <Heading level="h2">Fornecedor e custos</Heading>
              {detail.data.groups.map((group) => (
                <div className="mt-3 rounded border p-3" key={group.id}>
                  <Text>
                    <strong>{group.provider}</strong> · modalidade{" "}
                    {group.fulfillment_mode}
                  </Text>
                  <Text>
                    Produto {group.routing_snapshot.sourceCost}{" "}
                    {group.routing_snapshot.currency} · frete{" "}
                    {group.routing_snapshot.shippingCost} · entregue R${" "}
                    {group.routing_snapshot.deliveredCost}
                  </Text>
                  <Text>Estoque: {group.routing_snapshot.inventoryStatus}</Text>
                </div>
              ))}
              <Heading className="mt-4" level="h3">
                Alternativas permitidas
              </Heading>
              {alternatives.data?.alternatives
                .filter(
                  (alternative) =>
                    !detail.data.groups.some(
                      (group) =>
                        group.supplier_offer_id === alternative.offer_id,
                    ),
                )
                .map((alternative) => (
                  <div
                    className="mt-2 flex items-center justify-between rounded border p-3"
                    key={alternative.offer_id}
                  >
                    <Text>
                      {alternative.provider} · {alternative.fulfillment_mode} ·{" "}
                      {alternative.unit_cost} {alternative.currency} · frete R${" "}
                      {alternative.shipping_brl ?? "desconhecido"} ·{" "}
                      {alternative.availability}
                    </Text>
                    <Button
                      variant="secondary"
                      disabled={action.isPending || !detail.data.groups[0]}
                      onClick={() => {
                        const group = detail.data.groups[0];
                        if (!group) return;
                        action.mutate({
                          path: `/admin/achilles/orders/${selected}/alternative`,
                          body: {
                            groupId: group.id,
                            offerId: alternative.offer_id,
                          },
                        });
                      }}
                    >
                      SELECIONAR E REAPROVAR
                    </Button>
                  </div>
                ))}
            </Container>
            <Container>
              <Heading level="h2">Aprovação humana</Heading>
              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => {
                    setConfirmed(event.target.checked);
                  }}
                />
                Confirmo fornecedor, itens, custos, frete, margem e warnings.
              </label>
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={
                    !confirmed ||
                    detail.data.gate.status !== "APPROVAL_REQUIRED" ||
                    action.isPending
                  }
                  onClick={() => {
                    action.mutate({
                      path: `/admin/achilles/orders/${selected}/approve`,
                      body: { confirmed: true },
                    });
                  }}
                >
                  APROVAR PEDIDO AO FORNECEDOR
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    detail.data.plan?.status !== "APPROVED" || action.isPending
                  }
                  onClick={() => {
                    action.mutate({
                      path: `/admin/achilles/orders/${selected}/sandbox`,
                      body: { action: "CREATE" },
                    });
                  }}
                >
                  CRIAR PEDIDO TEST/SANDBOX
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    !detail.data.supplierOrders.some(
                      (order) => order.status === "CONFIRMED",
                    ) || action.isPending
                  }
                  onClick={() => {
                    action.mutate({
                      path: `/admin/achilles/orders/${selected}/sandbox`,
                      body: { action: "SHIP" },
                    });
                  }}
                >
                  MARCAR TEST SHIPPED
                </Button>
              </div>
              <Text className="mt-3 text-ui-fg-subtle">
                Pedido ao fornecedor: manual. Alibaba/CJ não recebem pedidos ou
                pagamentos automaticamente.
              </Text>
              {action.isError && <ErrorState message={String(action.error)} />}
            </Container>
            <Container>
              <details>
                <summary className="cursor-pointer font-medium">
                  Detalhes avançados e auditoria
                </summary>
                {detail.data.supplierOrders.map((order) => (
                  <Text key={order.id}>
                    {order.id} · {order.provider} · {order.status} · sandbox{" "}
                    {String(order.sandbox)}
                  </Text>
                ))}
                {detail.data.tracking.map((tracking) => (
                  <Text key={tracking.tracking_number}>
                    {tracking.carrier} · {tracking.tracking_number} ·{" "}
                    {tracking.status} · TEST
                  </Text>
                ))}
                {detail.data.exceptions.map((exception) => (
                  <div
                    className="mt-2 flex items-center gap-2"
                    key={exception.id}
                  >
                    <Text>
                      {exception.severity} · {exception.message} ·{" "}
                      {exception.status}
                    </Text>
                    {exception.status !== "RESOLVED" && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          action.mutate({
                            path: `/admin/achilles/orders/${selected}/exceptions/${exception.id}`,
                            body: {
                              status:
                                exception.status === "OPEN"
                                  ? "ACKNOWLEDGED"
                                  : "RESOLVED",
                            },
                          });
                        }}
                      >
                        {exception.status === "OPEN"
                          ? "RECONHECER"
                          : "RESOLVER"}
                      </Button>
                    )}
                  </div>
                ))}
                {detail.data.audit.map((event, index) => (
                  <Text key={`${event.action}-${String(index)}`}>
                    {event.action} · {event.summary}
                  </Text>
                ))}
              </details>
            </Container>
          </>
        ))}
    </div>
  );
};

function money(value: string, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number(value),
  );
}

export const config = defineRouteConfig({ label: "PEDIDOS", rank: 40 });
export default OrdersPage;
