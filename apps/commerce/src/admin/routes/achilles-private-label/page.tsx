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
import type { BrandingProfile } from "../../lib/types";

type BrandingList = { profiles: BrandingProfile[] };
const blank = {
  supplier_id: "",
  name: "",
  brand_name: "",
  currency: "USD",
  language: "pt-BR",
};

const PrivateLabelPage = () => {
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const query = useQuery({
    queryKey: ["achilles-branding"],
    queryFn: () => sdk.client.fetch<BrandingList>("/admin/achilles/branding"),
  });
  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/achilles/branding", {
        method: "POST",
        body: form,
      }),
    onSuccess: async () => {
      setForm(blank);
      await client.invalidateQueries({ queryKey: ["achilles-branding"] });
    },
  });
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Private Label</Heading>
        <Text className="text-ui-fg-subtle">
          Perfis e instruções da marca própria. Upload e geração de logo não
          fazem parte desta etapa.
        </Text>
      </Container>
      <Container>
        <Heading level="h2">Novo perfil</Heading>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            placeholder="ID do fornecedor"
            value={form.supplier_id}
            onChange={(e) => {
              setForm({ ...form, supplier_id: e.target.value });
            }}
          />
          <Input
            placeholder="Nome interno"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
            }}
          />
          <Input
            placeholder="Nome da marca"
            value={form.brand_name}
            onChange={(e) => {
              setForm({ ...form, brand_name: e.target.value });
            }}
          />
          <Input
            placeholder="Moeda"
            value={form.currency}
            onChange={(e) => {
              setForm({ ...form, currency: e.target.value });
            }}
          />
          <Button
            disabled={
              create.isPending ||
              !form.supplier_id ||
              form.name.length < 2 ||
              form.brand_name.length < 2
            }
            onClick={() => {
              create.mutate();
            }}
          >
            Criar perfil
          </Button>
        </div>
        {create.isError && <ErrorState message={String(create.error)} />}
      </Container>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={String(query.error)} />
      ) : !query.data.profiles.length ? (
        <EmptyState>Nenhum perfil de marca cadastrado.</EmptyState>
      ) : (
        query.data.profiles.map((profile) => (
          <Container key={profile.id}>
            <Heading level="h2">{profile.brand_name}</Heading>
            <Text>
              {profile.name} ·{" "}
              {profile.supplier?.name || "Fornecedor associado"}
            </Text>
            <div className="mt-2 flex gap-2">
              <Badge color="green">Marca própria</Badge>
              <Badge color="grey">{profile.language}</Badge>
            </div>
            <Text className="mt-2">
              MOQ: {profile.branding_moq ?? "não informado"} · Lead time:{" "}
              {profile.lead_time_days ?? "não informado"} dias
            </Text>
          </Container>
        ))
      )}
    </div>
  );
};

export const config = defineRouteConfig({ label: "ACHILLES · Private Label" });
export default PrivateLabelPage;
