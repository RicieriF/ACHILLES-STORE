import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/page-state";
import { sdk } from "../../lib/sdk";
import type { ProductPolicy } from "../../lib/types";

type PolicyList = { policies: ProductPolicy[] };
type AuditList = {
  events: Array<{
    id: string;
    summary: string;
    actor_id?: string | null;
    created_at: string;
  }>;
};
const labels = {
  PENDING: "Pendente",
  CLEAR: "Liberado",
  REVIEW_REQUIRED: "Revisão obrigatória",
  BLOCKED: "Bloqueado",
};
const colors = {
  PENDING: "orange",
  CLEAR: "green",
  REVIEW_REQUIRED: "orange",
  BLOCKED: "red",
} as const;

const CompliancePage = () => {
  const client = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["achilles-policies"],
    queryFn: () => sdk.client.fetch<PolicyList>("/admin/achilles/policies"),
  });
  const history = useQuery({
    queryKey: ["achilles-compliance-history"],
    queryFn: () =>
      sdk.client.fetch<AuditList>("/admin/achilles/audit", {
        query: { limit: 10 },
      }),
  });
  const update = useMutation({
    mutationFn: ({
      policy,
      status,
      note,
    }: {
      policy: ProductPolicy;
      status: ProductPolicy["compliance_status"];
      note: string | null;
    }) =>
      sdk.client.fetch(`/admin/achilles/policies/${policy.id}`, {
        method: "POST",
        body: {
          fulfillment_mode: policy.fulfillment_mode,
          compliance_status: status,
          sensitivity: policy.sensitivity,
          compliance_notes: note,
        },
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["achilles-policies"] }),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={String(query.error)} />;
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Compliance</Heading>
        <Text className="text-ui-fg-subtle">
          Fila de revisão com regras obrigatórias para itens sensíveis.
        </Text>
      </Container>
      {!query.data.policies.length ? (
        <EmptyState>Nenhum produto aguardando avaliação.</EmptyState>
      ) : (
        query.data.policies.map((policy) => (
          <Container key={policy.id}>
            <div className="flex justify-between gap-4">
              <div>
                <Heading level="h2">Produto {policy.product_id}</Heading>
                <Text>Sensibilidade: {policy.sensitivity}</Text>
                <Text>{policy.compliance_notes || "Sem observação"}</Text>
                <Input
                  className="mt-3"
                  placeholder="Observação da revisão"
                  value={notes[policy.id] ?? policy.compliance_notes ?? ""}
                  onChange={(event) => {
                    setNotes({ ...notes, [policy.id]: event.target.value });
                  }}
                />
              </div>
              <div className="flex max-w-md flex-wrap items-center justify-end gap-2">
                <Badge color={colors[policy.compliance_status]}>
                  {labels[policy.compliance_status]}
                </Badge>
                <Button
                  variant="secondary"
                  disabled={policy.sensitivity !== "ORDINARY"}
                  onClick={() => {
                    update.mutate({
                      policy,
                      status: "CLEAR",
                      note: notes[policy.id] ?? policy.compliance_notes ?? null,
                    });
                  }}
                >
                  Aprovar
                </Button>
                <Button
                  variant="secondary"
                  disabled={policy.sensitivity === "CONTROLLED_ITEM"}
                  onClick={() => {
                    update.mutate({
                      policy,
                      status: "REVIEW_REQUIRED",
                      note: notes[policy.id] ?? policy.compliance_notes ?? null,
                    });
                  }}
                >
                  Marcar revisão
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    update.mutate({
                      policy,
                      status: "BLOCKED",
                      note: notes[policy.id] ?? policy.compliance_notes ?? null,
                    });
                  }}
                >
                  Bloquear
                </Button>
              </div>
            </div>
          </Container>
        ))
      )}
      <Container>
        <Heading level="h2">Histórico administrativo recente</Heading>
        {history.isPending ? (
          <Text>Carregando histórico…</Text>
        ) : history.isError ? (
          <ErrorState message={String(history.error)} />
        ) : !history.data.events.length ? (
          <Text className="text-ui-fg-subtle">Nenhuma decisão registrada.</Text>
        ) : (
          history.data.events.map((event) => (
            <div key={event.id} className="mt-3 border-t pt-3">
              <Text weight="plus">{event.summary}</Text>
              <Text className="text-ui-fg-subtle">
                {new Date(event.created_at).toLocaleString("pt-BR")} ·{" "}
                {event.actor_id || "ator não disponível"}
              </Text>
            </div>
          ))
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({ label: "ACHILLES · Compliance" });
export default CompliancePage;
