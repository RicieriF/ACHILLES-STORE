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
  logo_asset_reference: "",
  packaging_instructions: "",
  insert_instructions: "",
  customization_notes: "",
  branding_moq: "",
  setup_cost: "",
  per_unit_branding_cost: "",
  lead_time_days: "",
};

const normalizeBrandingForm = (form: typeof blank) => ({
  ...form,
  logo_asset_reference: form.logo_asset_reference || null,
  packaging_instructions: form.packaging_instructions || null,
  insert_instructions: form.insert_instructions || null,
  customization_notes: form.customization_notes || null,
  branding_moq: form.branding_moq ? Number(form.branding_moq) : null,
  setup_cost: form.setup_cost || null,
  per_unit_branding_cost: form.per_unit_branding_cost || null,
  lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
});

const BrandingEditor = ({ profile }: { profile: BrandingProfile }) => {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ...blank,
    supplier_id: profile.supplier?.id ?? "",
    name: profile.name,
    brand_name: profile.brand_name,
    currency: profile.currency,
    language: profile.language,
    logo_asset_reference: profile.logo_asset_reference ?? "",
    packaging_instructions: profile.packaging_instructions ?? "",
    insert_instructions: profile.insert_instructions ?? "",
    customization_notes: profile.customization_notes ?? "",
    branding_moq: String(profile.branding_moq ?? ""),
    setup_cost: profile.setup_cost ?? "",
    per_unit_branding_cost: profile.per_unit_branding_cost ?? "",
    lead_time_days: String(profile.lead_time_days ?? ""),
  });
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/branding/${profile.id}`, {
        method: "POST",
        body: normalizeBrandingForm(form),
      }),
    onSuccess: async () => {
      setEditing(false);
      await client.invalidateQueries({ queryKey: ["achilles-branding"] });
    },
  });
  if (!editing)
    return (
      <Button
        className="mt-3"
        variant="secondary"
        onClick={() => {
          setEditing(true);
        }}
      >
        Editar perfil
      </Button>
    );
  return (
    <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
      {(
        [
          ["Nome interno", "name"],
          ["Nome da marca", "brand_name"],
          ["URL/referência do logo", "logo_asset_reference"],
          ["Instruções de embalagem", "packaging_instructions"],
          ["Instruções de insert/manual", "insert_instructions"],
          ["Notas de customização", "customization_notes"],
          ["Idioma", "language"],
          ["MOQ de branding", "branding_moq"],
          ["Custo de setup", "setup_cost"],
          ["Custo por unidade", "per_unit_branding_cost"],
          ["Moeda", "currency"],
          ["Lead time em dias", "lead_time_days"],
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
        body: normalizeBrandingForm(form),
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
          {(
            [
              ["URL/referência do logo", "logo_asset_reference"],
              ["Instruções de embalagem", "packaging_instructions"],
              ["Instruções de insert/manual", "insert_instructions"],
              ["Notas de customização", "customization_notes"],
              ["MOQ de branding", "branding_moq"],
              ["Custo de setup", "setup_cost"],
              ["Custo por unidade", "per_unit_branding_cost"],
              ["Lead time em dias", "lead_time_days"],
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
            <BrandingEditor profile={profile} />
          </Container>
        ))
      )}
    </div>
  );
};

export const config = defineRouteConfig({});
export default PrivateLabelPage;
