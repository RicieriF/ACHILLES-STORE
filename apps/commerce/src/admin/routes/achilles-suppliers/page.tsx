import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Text,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/page-state";
import { sdk } from "../../lib/sdk";
import type { Supplier } from "../../lib/types";

type SupplierList = { suppliers: Supplier[]; count: number };
const blank = {
  name: "",
  provider: "MANUAL",
  country_code: "CN",
  contact_email: "",
  contact_name: "",
  contact_phone: "",
  notes: "",
  metadata_reference: "",
};

const SupplierEditor = ({ supplier }: { supplier: Supplier }) => {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: supplier.name,
    provider: supplier.provider,
    country_code: supplier.country_code,
    contact_name: supplier.contact_name ?? "",
    contact_email: supplier.contact_email ?? "",
    contact_phone: supplier.contact_phone ?? "",
    notes: supplier.notes ?? "",
    metadata_reference: String(supplier.metadata?.reference ?? ""),
  });
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/suppliers/${supplier.id}`, {
        method: "POST",
        body: {
          ...form,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          notes: form.notes || null,
          metadata: form.metadata_reference
            ? { reference: form.metadata_reference }
            : {},
          metadata_reference: undefined,
        },
      }),
    onSuccess: async () => {
      setEditing(false);
      await client.invalidateQueries({ queryKey: ["achilles-suppliers"] });
    },
  });
  if (!editing)
    return (
      <Button
        variant="secondary"
        onClick={() => {
          setEditing(true);
        }}
      >
        Editar cadastro
      </Button>
    );
  return (
    <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
      {(
        [
          ["Nome", "name"],
          ["País (ISO-2)", "country_code"],
          ["Contato", "contact_name"],
          ["E-mail", "contact_email"],
          ["Telefone", "contact_phone"],
          ["Observações", "notes"],
          ["Referência metadata", "metadata_reference"],
        ] as const
      ).map(([placeholder, field]) => (
        <Input
          key={field}
          placeholder={placeholder}
          value={form[field]}
          onChange={(event) => {
            setForm({ ...form, [field]: event.target.value });
          }}
        />
      ))}
      <div className="flex gap-2">
        <Button
          disabled={save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          Salvar alterações
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(false);
          }}
        >
          Cancelar
        </Button>
      </div>
      {save.isError && <ErrorState message={String(save.error)} />}
    </div>
  );
};

const SuppliersPage = () => {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank);
  const query = useQuery({
    queryKey: ["achilles-suppliers", q],
    queryFn: () =>
      sdk.client.fetch<SupplierList>("/admin/achilles/suppliers", {
        query: { q },
      }),
  });
  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/achilles/suppliers", {
        method: "POST",
        body: {
          ...form,
          status: "ACTIVE",
          contact_email: form.contact_email || null,
          contact_name: form.contact_name || null,
          contact_phone: form.contact_phone || null,
          notes: form.notes || null,
          metadata: form.metadata_reference
            ? { reference: form.metadata_reference }
            : {},
          metadata_reference: undefined,
        },
      }),
    onSuccess: async () => {
      setForm(blank);
      await client.invalidateQueries({ queryKey: ["achilles-suppliers"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (supplier: Supplier) =>
      sdk.client.fetch(`/admin/achilles/suppliers/${supplier.id}`, {
        method: "POST",
        body: { status: supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["achilles-suppliers"] }),
  });
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Fornecedores</Heading>
        <Text className="text-ui-fg-subtle">
          Cadastros manuais; nenhum provider possui conexão externa nesta etapa.
        </Text>
        <Input
          className="mt-4"
          placeholder="Buscar por nome"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
      </Container>
      <Container>
        <Heading level="h2">Novo fornecedor</Heading>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            placeholder="Nome"
            value={form.name}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value });
            }}
          />
          <Select
            value={form.provider}
            onValueChange={(provider) => {
              setForm({ ...form, provider });
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="MANUAL">Manual</Select.Item>
              <Select.Item value="OTHER">Outro</Select.Item>
              <Select.Item value="ALIBABA">
                Alibaba (somente cadastro)
              </Select.Item>
            </Select.Content>
          </Select>
          <Input
            placeholder="País (ISO-2)"
            value={form.country_code}
            onChange={(event) => {
              setForm({ ...form, country_code: event.target.value });
            }}
          />
          <Input
            placeholder="Nome do contato"
            value={form.contact_name}
            onChange={(event) => {
              setForm({ ...form, contact_name: event.target.value });
            }}
          />
          <Input
            placeholder="E-mail de contato"
            value={form.contact_email}
            onChange={(event) => {
              setForm({ ...form, contact_email: event.target.value });
            }}
          />
          <Input
            placeholder="Telefone"
            value={form.contact_phone}
            onChange={(event) => {
              setForm({ ...form, contact_phone: event.target.value });
            }}
          />
          <Input
            placeholder="Observações"
            value={form.notes}
            onChange={(event) => {
              setForm({ ...form, notes: event.target.value });
            }}
          />
          <Input
            placeholder="Referência metadata"
            value={form.metadata_reference}
            onChange={(event) => {
              setForm({ ...form, metadata_reference: event.target.value });
            }}
          />
          <Button
            disabled={create.isPending || form.name.length < 2}
            onClick={() => {
              create.mutate();
            }}
          >
            {create.isPending ? "Salvando…" : "Criar fornecedor"}
          </Button>
        </div>
        {create.isError && <ErrorState message={String(create.error)} />}
      </Container>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={String(query.error)} />
      ) : !query.data.suppliers.length ? (
        <EmptyState>Nenhum fornecedor encontrado.</EmptyState>
      ) : (
        query.data.suppliers.map((supplier) => (
          <Container key={supplier.id}>
            <div className="flex items-center justify-between">
              <div>
                <Heading level="h2">{supplier.name}</Heading>
                <Text>
                  {supplier.provider} · {supplier.country_code}
                </Text>
                <Text className="text-ui-fg-subtle">
                  {supplier.contact_email || "Sem contato informado"}
                </Text>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={supplier.status === "ACTIVE" ? "green" : "grey"}>
                  {supplier.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </Badge>
                <Button
                  variant="secondary"
                  onClick={() => {
                    toggle.mutate(supplier);
                  }}
                >
                  {supplier.status === "ACTIVE" ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </div>
            <SupplierEditor supplier={supplier} />
          </Container>
        ))
      )}
    </div>
  );
};

export const config = defineRouteConfig({ label: "ACHILLES · Fornecedores" });
export default SuppliersPage;
