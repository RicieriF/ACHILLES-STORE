import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type {
  AdminProduct,
  DetailWidgetProps,
} from "@medusajs/framework/types";
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
import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "../components/page-state";
import { sdk } from "../lib/sdk";
import type { CostQuote, PricingSnapshot, SupplierOffer } from "../lib/types";

type Origin = { offers: SupplierOffer[] };
type PricingResponse = { quote: CostQuote; snapshots: PricingSnapshot[] };
type Form = {
  fxRate: string;
  fxSource: string;
  fxTimestamp: string;
  internationalShipping: string;
  internationalShippingAllocationMethod: "PER_UNIT" | "BY_QUANTITY" | "MANUAL";
  shippingAllocationQuantity: string;
  customsTaxEstimate: string;
  customsStrategy:
    "CUSTOMER_AS_IMPORTER" | "MERCHANT_AS_IMPORTER" | "MANUAL_QUOTE";
  brandingUnitCost: string;
  brandingSetupCost: string;
  brandingSetupAllocationQuantity: string;
  paymentGatewayPercent: string;
  paymentGatewayFixed: string;
  paymentGatewayProvider: string;
  localDeliveryCost: string;
  returnsRiskReservePercent: string;
  returnsRiskReserveFixed: string;
  operationalReservePercent: string;
  operationalReserveFixed: string;
  targetMarginPercent: string;
  promotionalBufferPercent: string;
  assumptions: string;
};

const emptyForm = (): Form => ({
  fxRate: "",
  fxSource: "Manual Admin",
  fxTimestamp: new Date().toISOString(),
  internationalShipping: "",
  internationalShippingAllocationMethod: "PER_UNIT",
  shippingAllocationQuantity: "1",
  customsTaxEstimate: "",
  customsStrategy: "MANUAL_QUOTE",
  brandingUnitCost: "",
  brandingSetupCost: "",
  brandingSetupAllocationQuantity: "1",
  paymentGatewayPercent: "",
  paymentGatewayFixed: "",
  paymentGatewayProvider: "Premissa manual",
  localDeliveryCost: "",
  returnsRiskReservePercent: "",
  returnsRiskReserveFixed: "",
  operationalReservePercent: "",
  operationalReserveFixed: "",
  targetMarginPercent: "",
  promotionalBufferPercent: "",
  assumptions: "Estimativas manuais sujeitas a revisão",
});

const ProductPricingWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const client = useQueryClient();
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState(false);
  const origin = useQuery({
    queryKey: ["pricing-origin", data.id],
    queryFn: () =>
      sdk.client.fetch<Origin>(
        `/admin/achilles/products/${data.id}/import-origin`,
      ),
  });
  const quoteId = origin.data?.offers[0]?.cost_quotes?.[0]?.id;
  const pricing = useQuery({
    queryKey: ["pricing", quoteId],
    enabled: Boolean(quoteId),
    queryFn: () =>
      sdk.client.fetch<PricingResponse>(
        `/admin/achilles/pricing/${quoteId ?? ""}`,
      ),
  });
  const quote = pricing.data?.quote;
  useEffect(() => {
    if (!quote) return;
    setForm({
      fxRate: quote.fx_rate ?? "",
      fxSource: quote.fx_source ?? "Manual Admin",
      fxTimestamp: quote.fx_captured_at ?? new Date().toISOString(),
      internationalShipping: quote.international_freight ?? "",
      internationalShippingAllocationMethod:
        quote.international_shipping_allocation_method ?? "PER_UNIT",
      shippingAllocationQuantity: String(
        quote.shipping_allocation_quantity ?? 1,
      ),
      customsTaxEstimate: quote.customs_tax ?? "",
      customsStrategy: quote.customs_strategy ?? "MANUAL_QUOTE",
      brandingUnitCost: quote.branding_cost ?? "",
      brandingSetupCost: quote.branding_setup_cost ?? "",
      brandingSetupAllocationQuantity: String(
        quote.branding_setup_allocation ?? 1,
      ),
      paymentGatewayPercent: quote.payment_gateway_percent ?? "",
      paymentGatewayFixed: quote.payment_fee ?? "",
      paymentGatewayProvider:
        quote.payment_gateway_provider ?? "Premissa manual",
      localDeliveryCost: quote.local_delivery ?? "",
      returnsRiskReservePercent: quote.returns_risk_reserve_percent ?? "",
      returnsRiskReserveFixed: quote.risk_reserve ?? "",
      operationalReservePercent: quote.operational_reserve_percent ?? "",
      operationalReserveFixed: quote.operational_reserve ?? "",
      targetMarginPercent: quote.target_margin ?? "",
      promotionalBufferPercent: quote.promotional_buffer ?? "",
      assumptions:
        quote.assumptions?.items.join("\n") ??
        "Estimativas manuais sujeitas a revisão",
    });
  }, [quote]);
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["pricing", quoteId] });
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/pricing/${quoteId ?? ""}`, {
        method: "POST",
        body: {
          ...form,
          shippingAllocationQuantity: Number(form.shippingAllocationQuantity),
          brandingSetupAllocationQuantity: Number(
            form.brandingSetupAllocationQuantity,
          ),
          assumptions: form.assumptions
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: async () => {
      setEditing(false);
      await refresh();
    },
  });
  const calculate = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/pricing/${quoteId ?? ""}/calculate`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/pricing/${quoteId ?? ""}/approve`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });
  const change = (field: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  if (!quoteId) return null;
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Pricing</Heading>
          <Text className="text-ui-fg-subtle">
            Estimativa rastreável; calcular não publica.
          </Text>
        </div>
        <Badge
          color={
            quote?.status === "PRICED"
              ? "green"
              : quote?.status === "STALE"
                ? "orange"
                : "grey"
          }
        >
          {quote?.status ?? "INCOMPLETE"}
        </Badge>
      </div>
      {pricing.isPending ? (
        <div className="p-6">
          <LoadingState />
        </div>
      ) : pricing.isError ? (
        <div className="p-6">
          <ErrorState message={String(pricing.error)} />
        </div>
      ) : (
        quote && (
          <>
            <div className="grid gap-2 px-6 py-4 md:grid-cols-3">
              <Metric
                label="Custo China"
                value={`${quote.source_currency} ${quote.supplier_unit_cost}`}
              />
              <Metric
                label="FX"
                value={
                  quote.fx_rate
                    ? `${quote.fx_rate} · ${quote.fx_source ?? "fonte pendente"}`
                    : "Pendente"
                }
              />
              <Metric label="MOQ" value={String(quote.moq)} />
              <Metric label="Landed cost" value={money(quote.landed_cost)} />
              <Metric
                label="Break-even"
                value={money(quote.break_even_price)}
              />
              <Metric
                label="Preço sugerido"
                value={money(quote.suggested_retail_price)}
              />
              <Metric
                label="Margem bruta"
                value={
                  quote.gross_margin_percent
                    ? `${quote.gross_margin_percent}%`
                    : "Pendente"
                }
              />
              <Metric
                label="Contribuição"
                value={money(quote.contribution_margin)}
              />
              <Metric
                label="Preço aprovado"
                value={money(quote.approved_retail_price)}
              />
            </div>
            {quote.status === "STALE" && (
              <Text className="px-6 py-3 text-ui-fg-error">
                Preço precisa ser recalculado.
              </Text>
            )}
            {quote.warnings?.items.map((warning) => (
              <Text key={warning} className="px-6 text-ui-fg-subtle">
                ⚠ {warning}
              </Text>
            ))}
            {editing && <PricingForm form={form} change={change} />}
            <div className="flex flex-wrap gap-2 px-6 py-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((value) => !value);
                }}
              >
                Editar premissas
              </Button>
              {editing && (
                <Button
                  disabled={save.isPending}
                  onClick={() => {
                    save.mutate();
                  }}
                >
                  Salvar premissas
                </Button>
              )}
              <Button
                disabled={quote.status === "INCOMPLETE" || calculate.isPending}
                onClick={() => {
                  calculate.mutate();
                }}
              >
                {quote.status === "PRICED" || quote.status === "STALE"
                  ? "Recalcular"
                  : "Calcular"}
              </Button>
              <Button
                disabled={quote.status !== "PRICED" || approve.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Aprovar este preço sugerido? O produto continuará DRAFT.",
                    )
                  )
                    approve.mutate();
                }}
              >
                Aprovar preço
              </Button>
            </div>
            {(save.isError || calculate.isError || approve.isError) && (
              <div className="px-6 pb-4">
                <ErrorState
                  message={String(
                    save.error ?? calculate.error ?? approve.error,
                  )}
                />
              </div>
            )}
            <div className="px-6 py-4">
              <Heading level="h3">Histórico</Heading>
              {pricing.data.snapshots.map((snapshot) => (
                <Text key={snapshot.id}>
                  v{snapshot.version} · engine {snapshot.engine_version} ·{" "}
                  {new Date(snapshot.calculated_at).toLocaleString("pt-BR")}{" "}
                  {snapshot.approved_at ? "· APROVADO" : ""}
                </Text>
              ))}
            </div>
          </>
        )
      )}
    </Container>
  );
};

const fields: Array<[keyof Form, string]> = [
  ["fxRate", "FX USD/BRL"],
  ["fxSource", "Fonte FX"],
  ["fxTimestamp", "Timestamp FX em UTC"],
  ["internationalShipping", "Frete internacional"],
  ["shippingAllocationQuantity", "Quantidade rateio frete"],
  ["customsTaxEstimate", "Tributação estimada"],
  ["brandingUnitCost", "Branding unitário"],
  ["brandingSetupCost", "Setup branding"],
  ["brandingSetupAllocationQuantity", "Quantidade rateio branding"],
  ["paymentGatewayPercent", "Gateway %"],
  ["paymentGatewayFixed", "Gateway fixo"],
  ["paymentGatewayProvider", "Premissa gateway"],
  ["localDeliveryCost", "Frete local"],
  ["returnsRiskReservePercent", "Devoluções %"],
  ["returnsRiskReserveFixed", "Devoluções fixo"],
  ["operationalReservePercent", "Reserva operacional %"],
  ["operationalReserveFixed", "Reserva operacional fixa"],
  ["targetMarginPercent", "Margem alvo %"],
  ["promotionalBufferPercent", "Buffer promocional %"],
];
const PricingForm = ({
  form,
  change,
}: {
  form: Form;
  change: (field: keyof Form, value: string) => void;
}) => (
  <div className="grid gap-3 px-6 py-4 md:grid-cols-3">
    {fields.map(([field, label]) => (
      <Input
        key={field}
        placeholder={label}
        value={form[field]}
        onChange={(event) => {
          change(field, event.target.value);
        }}
      />
    ))}
    <Select
      value={form.internationalShippingAllocationMethod}
      onValueChange={(value) => {
        change("internationalShippingAllocationMethod", value);
      }}
    >
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="PER_UNIT">Frete por unidade</Select.Item>
        <Select.Item value="BY_QUANTITY">Frete total do lote</Select.Item>
        <Select.Item value="MANUAL">Rateio manual</Select.Item>
      </Select.Content>
    </Select>
    <Select
      value={form.customsStrategy}
      onValueChange={(value) => {
        change("customsStrategy", value);
      }}
    >
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="CUSTOMER_AS_IMPORTER">
          Cliente importador
        </Select.Item>
        <Select.Item value="MERCHANT_AS_IMPORTER">
          Lojista importador
        </Select.Item>
        <Select.Item value="MANUAL_QUOTE">Cotação manual</Select.Item>
      </Select.Content>
    </Select>
    <Input
      placeholder="Premissas, uma por linha"
      value={form.assumptions}
      onChange={(event) => {
        change("assumptions", event.target.value);
      }}
    />
  </div>
);
const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <Text className="text-ui-fg-subtle">{label}</Text>
    <Text weight="plus">{value}</Text>
  </div>
);
const money = (value?: string | null) =>
  value ? `R$ ${value}` : "Ainda não definido";

export const config = defineWidgetConfig({ zone: "product.details" });
export default ProductPricingWidget;
