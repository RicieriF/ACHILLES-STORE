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
import { useMemo, useState, type ChangeEvent } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/page-state";
import {
  adminErrorMessage,
  attentionLabels,
  humanStatus,
  money,
  statusBadgeColor,
  type OperationalProduct,
} from "../../lib/operations";
import { sdk } from "../../lib/sdk";

type CatalogData = {
  products: OperationalProduct[];
  count: number;
  limit: number;
  offset: number;
  storefrontUrl: string | null;
};
type CategoryData = { product_categories: Array<{ id: string; name: string }> };
type SupplierData = { suppliers: Array<{ id: string; name: string }> };
type ProductMediaData = {
  product: { images?: Array<{ url: string }> };
};
type View = "CARDS" | "TABLE";
type Filter = "ALL" | "DRAFT" | "PUBLISHED" | "ATTENTION";

const splitValues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const buildQuickVariants = (form: {
  sku: string;
  colors: string;
  sizes: string;
  powers: string;
}) => {
  const colors = splitValues(form.colors);
  const sizes = splitValues(form.sizes);
  const powers = splitValues(form.powers);
  if (!colors.length && !sizes.length && !powers.length) return [];
  const combinations = (colors.length ? colors : [""]).flatMap((color) =>
    (sizes.length ? sizes : [""]).flatMap((size) =>
      (powers.length ? powers : [""]).map((power) => ({ color, size, power })),
    ),
  );
  return combinations.slice(0, 40).map((variant, index) => ({
    title: [variant.color, variant.size, variant.power]
      .filter(Boolean)
      .join(" / "),
    ...(form.sku ? { sku: `${form.sku}-${String(index + 1)}` } : {}),
    ...(variant.color ? { color: variant.color } : {}),
    ...(variant.size ? { size: variant.size } : {}),
    ...(variant.power ? { power: variant.power } : {}),
  }));
};

const ProductCard = ({
  product,
  edit,
  duplicate,
  selected,
  select,
}: {
  product: OperationalProduct;
  edit: (product: OperationalProduct) => void;
  duplicate: (id: string) => void;
  selected: boolean;
  select: (id: string) => void;
}) => (
  <div
    className="overflow-hidden rounded-lg border bg-ui-bg-base"
    data-testid="catalog-product-card"
  >
    <div className="flex h-48 items-center justify-center bg-ui-bg-subtle">
      {product.thumbnail ? (
        <img
          alt={product.title}
          className="h-full w-full object-contain"
          src={product.thumbnail}
        />
      ) : (
        <Text className="text-ui-fg-muted">Sem imagem</Text>
      )}
    </div>
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <input
            aria-label={`Selecionar ${product.title}`}
            checked={selected}
            onChange={() => {
              select(product.id);
            }}
            type="checkbox"
          />
          <div>
            <Heading level="h2">{product.title}</Heading>
            <Text className="text-ui-fg-subtle">
              {product.sku ?? "Sem SKU"} · {product.category ?? "Sem categoria"}
            </Text>
          </div>
        </div>
        <Badge color={statusBadgeColor(product.operationalStatus)}>
          {humanStatus(product.operationalStatus)}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Text>
          <strong>Venda:</strong> {money(product.retailPrice)}
        </Text>
        <Text>
          <strong>Custo:</strong> {money(product.landedCost)}
        </Text>
        <Text>
          <strong>Margem:</strong>{" "}
          {product.marginPercent === null
            ? "Não calculada"
            : `${String(product.marginPercent)}%`}
        </Text>
        <Text>
          <strong>Estoque:</strong> {product.stock ?? "Não informado"}
        </Text>
      </div>
      <Text>
        {product.supplier ?? "Fornecedor não vinculado"}
        {product.provider ? ` · ${product.provider}` : ""}
      </Text>
      <div className="flex flex-wrap gap-1">
        {product.attention.slice(0, 3).map((reason) => (
          <Badge color="orange" key={reason}>
            {attentionLabels[reason]}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            edit(product);
          }}
        >
          Edição rápida
        </Button>
        <a href={`/app/products/${product.id}`}>
          <Button variant="secondary">Editar completo</Button>
        </a>
        <Button
          variant="secondary"
          onClick={() => {
            duplicate(product.id);
          }}
        >
          Duplicar
        </Button>
        {product.origin && (
          <a href={product.origin} rel="noreferrer" target="_blank">
            <Button variant="secondary">Origem</Button>
          </a>
        )}
      </div>
    </div>
  </div>
);

const QuickCreate = ({
  close,
  onCreated,
}: {
  close: () => void;
  onCreated: () => void;
}) => {
  const client = useQueryClient();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    image_urls: [] as string[],
    price_brl: "",
    sku: "",
    availability: "UNKNOWN",
    fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
    supplier_id: "",
    supplier_product_id: "",
    source_url: "",
    supplier_cost: "",
    colors: "",
    sizes: "",
    powers: "",
  });
  const categories = useQuery({
    queryKey: ["product-categories-quick"],
    queryFn: () =>
      sdk.client.fetch<CategoryData>("/admin/product-categories", {
        query: { limit: 100 },
      }),
  });
  const suppliers = useQuery({
    queryKey: ["achilles-suppliers-quick"],
    queryFn: () =>
      sdk.client.fetch<SupplierData>("/admin/achilles/suppliers", {
        query: { limit: 100 },
      }),
  });
  const create = useMutation({
    mutationFn: (_intent: "CLOSE" | "CONTINUE") =>
      sdk.client.fetch<{ product: { id: string } }>(
        "/admin/achilles/operations/products",
        {
          method: "POST",
          body: {
            ...form,
            description: form.description.trim() || null,
            category_id: form.category_id || null,
            price_brl: form.price_brl ? Number(form.price_brl) : null,
            sku: form.sku.trim() || null,
            supplier_id: form.supplier_id || null,
            supplier_product_id: form.supplier_product_id || null,
            source_url: form.source_url || null,
            supplier_cost: form.supplier_cost || null,
            variants: buildQuickVariants(form),
            colors: undefined,
            sizes: undefined,
            powers: undefined,
          },
        },
      ),
    onSuccess: async (data, intent) => {
      await client.invalidateQueries({ queryKey: ["achilles-catalog"] });
      await client.invalidateQueries({
        queryKey: ["achilles-operations-dashboard"],
      });
      onCreated();
      if (intent === "CONTINUE") {
        window.location.assign(`/app/products/${data.product.id}`);
        return;
      }
      close();
    },
  });
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const result = await sdk.admin.upload.create({ files });
      setForm((current) => ({
        ...current,
        image_urls: [
          ...current.image_urls,
          ...result.files.map((file) => file.url),
        ],
      }));
    } finally {
      setUploading(false);
    }
  };
  const canFinish = form.title.trim().length >= 2;
  const supplierLinked = Boolean(
    form.supplier_id &&
    form.supplier_product_id &&
    form.source_url &&
    form.supplier_cost,
  );
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      data-testid="quick-create-panel"
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-ui-bg-base p-6 shadow-elevation-flyout">
        <div className="flex items-start justify-between">
          <div>
            <Heading level="h1">Cadastro rápido</Heading>
            <Text className="text-ui-fg-subtle">
              Etapa {step} de 5 · o produto será salvo como DRAFT.
            </Text>
          </div>
          <Button variant="secondary" onClick={close}>
            Fechar
          </Button>
        </div>
        <div className="my-6 flex gap-1">
          {["Produto", "Imagem", "Preço e SKU", "Fornecedor", "Revisão"].map(
            (label, index) => (
              <div
                className={`flex-1 rounded p-2 text-center text-xs ${step === index + 1 ? "bg-ui-bg-interactive text-ui-fg-on-color" : "bg-ui-bg-subtle"}`}
                key={label}
              >
                {label}
              </div>
            ),
          )}
        </div>
        {step === 1 && (
          <div className="grid gap-3">
            <Input
              placeholder="Título"
              value={form.title}
              onChange={(event) => {
                setForm({ ...form, title: event.target.value });
              }}
            />
            <textarea
              className="min-h-32 rounded border bg-ui-bg-base p-3"
              placeholder="Descrição própria da loja"
              value={form.description}
              onChange={(event) => {
                setForm({ ...form, description: event.target.value });
              }}
            />
            <Select
              value={form.category_id}
              onValueChange={(category_id) => {
                setForm({ ...form, category_id });
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Categoria" />
              </Select.Trigger>
              <Select.Content>
                {categories.data?.product_categories.map((category) => (
                  <Select.Item key={category.id} value={category.id}>
                    {category.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4">
            <input
              accept="image/*"
              multiple
              onChange={(event) => {
                void upload(event);
              }}
              type="file"
            />
            <Text>
              {uploading
                ? "Enviando pelo File Module…"
                : `${String(form.image_urls.length)} imagem(ns) enviada(s)`}
            </Text>
            <div className="grid grid-cols-3 gap-2">
              {form.image_urls.map((url) => (
                <img
                  alt="Prévia"
                  className="h-28 w-full rounded border object-contain"
                  key={url}
                  src={url}
                />
              ))}
            </div>
            <Text className="text-ui-fg-subtle">
              Imagens são exibidas inteiras; nenhum corte é aplicado no
              catálogo.
            </Text>
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Preço BRL (opcional)"
              type="number"
              value={form.price_brl}
              onChange={(event) => {
                setForm({ ...form, price_brl: event.target.value });
              }}
            />
            <Input
              placeholder="SKU"
              value={form.sku}
              onChange={(event) => {
                setForm({ ...form, sku: event.target.value });
              }}
            />
            <Input
              placeholder="Cores, separadas por vírgula"
              value={form.colors}
              onChange={(event) => {
                setForm({ ...form, colors: event.target.value });
              }}
            />
            <Input
              placeholder="Tamanhos, separados por vírgula"
              value={form.sizes}
              onChange={(event) => {
                setForm({ ...form, sizes: event.target.value });
              }}
            />
            <Input
              placeholder="Alimentação, separada por vírgula"
              value={form.powers}
              onChange={(event) => {
                setForm({ ...form, powers: event.target.value });
              }}
            />
            <Select
              value={form.availability}
              onValueChange={(availability) => {
                setForm({ ...form, availability });
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="UNKNOWN">Não informado</Select.Item>
                <Select.Item value="IN_STOCK">Em estoque</Select.Item>
                <Select.Item value="OUT_OF_STOCK">Sem estoque</Select.Item>
              </Select.Content>
            </Select>
            <Select
              value={form.fulfillment_mode}
              onValueChange={(fulfillment_mode) => {
                setForm({ ...form, fulfillment_mode });
              }}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="PRIVATE_LABEL_DROPSHIP">
                  Private label dropship
                </Select.Item>
                <Select.Item value="GENERIC_DROPSHIP">
                  Dropship genérico
                </Select.Item>
                <Select.Item value="BRAZIL_STOCK">Estoque Brasil</Select.Item>
              </Select.Content>
            </Select>
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-3">
            <Select
              value={form.supplier_id}
              onValueChange={(supplier_id) => {
                setForm({ ...form, supplier_id });
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Sem fornecedor por enquanto" />
              </Select.Trigger>
              <Select.Content>
                {suppliers.data?.suppliers.map((supplier) => (
                  <Select.Item key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            {form.supplier_id && (
              <>
                <Input
                  placeholder="ID do produto no fornecedor"
                  value={form.supplier_product_id}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      supplier_product_id: event.target.value,
                    });
                  }}
                />
                <Input
                  placeholder="URL de origem"
                  value={form.source_url}
                  onChange={(event) => {
                    setForm({ ...form, source_url: event.target.value });
                  }}
                />
                <Input
                  placeholder="Custo USD"
                  value={form.supplier_cost}
                  onChange={(event) => {
                    setForm({ ...form, supplier_cost: event.target.value });
                  }}
                />
              </>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="space-y-3 rounded border p-4">
            <Heading level="h2">Revisão</Heading>
            <Text>{canFinish ? "✓ Título" : "⚠ Título obrigatório"}</Text>
            <Text>{form.image_urls.length ? "✓ Imagem" : "⚠ Sem imagem"}</Text>
            <Text>
              {form.price_brl
                ? `✓ Preço ${money(Number(form.price_brl))}`
                : "⚠ Preço não informado"}
            </Text>
            <Text>{form.sku ? "✓ SKU" : "⚠ SKU ausente"}</Text>
            <Text>
              {supplierLinked
                ? "✓ Fornecedor vinculado"
                : "⚠ Fornecedor não vinculado"}
            </Text>
            <Text>⚠ Compliance pendente</Text>
            <Text>
              Variantes: {String(buildQuickVariants(form).length || 1)}
            </Text>
            <Badge color="orange">DRAFT · incompleto</Badge>
          </div>
        )}
        {create.isError && (
          <div className="mt-4">
            <ErrorState message={String(create.error)} />
          </div>
        )}
        <div className="mt-8 flex justify-between">
          <Button
            disabled={step === 1}
            variant="secondary"
            onClick={() => {
              setStep((current) => current - 1);
            }}
          >
            Voltar
          </Button>
          {step < 5 ? (
            <Button
              onClick={() => {
                setStep((current) => current + 1);
              }}
            >
              Continuar
            </Button>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={!canFinish || create.isPending}
                variant="secondary"
                onClick={() => {
                  create.mutate("CONTINUE");
                }}
              >
                SALVAR E CONTINUAR EDITANDO
              </Button>
              <Button
                disabled={!canFinish || create.isPending}
                onClick={() => {
                  create.mutate("CLOSE");
                }}
              >
                {create.isPending ? "Salvando…" : "SALVAR DRAFT"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const QuickEdit = ({
  product,
  close,
}: {
  product: OperationalProduct;
  close: () => void;
}) => {
  const client = useQueryClient();
  const [title, setTitle] = useState(product.title);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [price, setPrice] = useState(product.retailPrice?.toString() ?? "");
  const [availability, setAvailability] = useState(
    product.availability ?? "UNKNOWN",
  );
  const [featured, setFeatured] = useState(product.featured);
  const [pendingImageUrls, setPendingImageUrls] = useState<string[] | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const categories = useQuery({
    queryKey: ["product-categories-quick"],
    queryFn: () =>
      sdk.client.fetch<CategoryData>("/admin/product-categories", {
        query: { limit: 100 },
      }),
  });
  const media = useQuery({
    queryKey: ["product-media-quick-edit", product.id],
    queryFn: () =>
      sdk.client.fetch<ProductMediaData>(`/admin/products/${product.id}`, {
        query: { fields: "+images.*" },
      }),
  });
  const previewImage = pendingImageUrls?.[0] ?? product.thumbnail;
  const validTitle = title.trim().length >= 2;
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/achilles/operations/products/${product.id}`, {
        method: "POST",
        body: {
          title: title.trim(),
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(pendingImageUrls ? { image_urls: pendingImageUrls } : {}),
          price_brl: price ? Number(price) : null,
          availability,
          featured,
          status: "draft",
        },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["achilles-catalog"] });
      await client.invalidateQueries({
        queryKey: ["achilles-operations-dashboard"],
      });
      setSaved(true);
    },
  });
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    setSaved(false);
    try {
      const result = await sdk.admin.upload.create({ files });
      const uploaded = result.files.map((file) => file.url);
      const existing =
        media.data?.product.images?.map((image) => image.url) ??
        (product.thumbnail ? [product.thumbnail] : []);
      setPendingImageUrls([
        ...uploaded,
        ...existing.filter((url) => !uploaded.includes(url)),
      ]);
    } catch (error) {
      setUploadError(adminErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div
        className="h-full w-full max-w-2xl overflow-y-auto overflow-x-hidden bg-ui-bg-base p-4 shadow-elevation-flyout sm:p-6"
        data-testid="quick-edit-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <Heading level="h1">Edição rápida</Heading>
          <Button variant="secondary" onClick={close}>
            Fechar
          </Button>
        </div>
        <Text className="mt-2 text-ui-fg-subtle">
          Alterações rápidas retornam o produto a DRAFT; aprovação e compliance
          não são alterados.
        </Text>
        <div className="mt-6 grid gap-4">
          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Produto</Heading>
            <label className="grid gap-1" htmlFor="quick-edit-title">
              <Text>Título</Text>
              <Input
                aria-invalid={!validTitle}
                id="quick-edit-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaved(false);
                }}
              />
            </label>
            {!validTitle && (
              <Text className="text-ui-fg-error">
                Informe um título válido.
              </Text>
            )}
            <div className="grid gap-1">
              <Text>Categoria</Text>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryId(value);
                  setSaved(false);
                }}
              >
                <Select.Trigger aria-label="Categoria">
                  <Select.Value placeholder="Sem categoria" />
                </Select.Trigger>
                <Select.Content>
                  {categories.data?.product_categories.map((category) => (
                    <Select.Item key={category.id} value={category.id}>
                      {category.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </section>

          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Imagem</Heading>
            <div className="flex min-h-40 items-center justify-center rounded border bg-ui-bg-subtle">
              {previewImage ? (
                <img
                  alt={`Thumbnail de ${product.title}`}
                  className="max-h-48 w-full object-contain"
                  src={previewImage}
                />
              ) : (
                <Text className="text-ui-fg-muted">Sem imagem</Text>
              )}
            </div>
            <label className="grid gap-1" htmlFor="quick-edit-image">
              <Text>{previewImage ? "Trocar imagem" : "Adicionar imagem"}</Text>
              <input
                accept="image/*"
                id="quick-edit-image"
                onChange={(event) => {
                  void upload(event);
                }}
                type="file"
              />
            </label>
            {uploading && <Text>Enviando pelo File Module…</Text>}
            {uploadError && <ErrorState message={uploadError} />}
          </section>

          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Comercial</Heading>
            <label className="grid gap-1" htmlFor="quick-edit-price">
              <Text>Preço de venda</Text>
              <Input
                id="quick-edit-price"
                min="0"
                placeholder="Não informado"
                step="0.01"
                type="number"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Text className="text-ui-fg-subtle">Custo atual</Text>
                <Text>{money(product.landedCost)}</Text>
              </div>
              <div>
                <Text className="text-ui-fg-subtle">Margem estimada</Text>
                <Text>
                  {product.marginPercent === null
                    ? "Não calculada"
                    : `${String(product.marginPercent)}%`}
                </Text>
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Estoque</Heading>
            <div className="grid gap-1">
              <Text>Disponibilidade</Text>
              <Select
                disabled={!product.offerId}
                value={availability}
                onValueChange={(value) => {
                  setAvailability(value);
                  setSaved(false);
                }}
              >
                <Select.Trigger aria-label="Disponibilidade">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="UNKNOWN">Não informado</Select.Item>
                  <Select.Item value="IN_STOCK">Disponível</Select.Item>
                  <Select.Item value="OUT_OF_STOCK">Indisponível</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div>
              <Text className="text-ui-fg-subtle">Quantidade</Text>
              <Text>
                {product.manageInventory
                  ? (product.stock ?? "Não informada")
                  : "Estoque não gerenciado"}
              </Text>
            </div>
          </section>

          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Fornecedor</Heading>
            {product.offerId ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Text className="text-ui-fg-subtle">
                    Fornecedor principal
                  </Text>
                  <Text>{product.supplier ?? "Não informado"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle">Provider</Text>
                  <Text>{product.provider ?? "Não informado"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle">
                    Estoque do fornecedor
                  </Text>
                  <Text>
                    {product.supplierAvailabilityQuantity ??
                      humanStatus(product.availability)}
                  </Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle">Prazo de branding</Text>
                  <Text>
                    {product.supplierLeadTimeDays === null
                      ? "Não informado"
                      : `${String(product.supplierLeadTimeDays)} dias`}
                  </Text>
                </div>
                {product.origin && (
                  <a
                    className="text-ui-fg-interactive"
                    href={product.origin}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir origem
                  </a>
                )}
              </div>
            ) : (
              <Badge color="orange">Fornecedor não vinculado</Badge>
            )}
            <a
              className="text-ui-fg-interactive"
              href="/app/achilles-products-suppliers"
            >
              Abrir fornecimento
            </a>
          </section>

          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Status</Heading>
            <div className="flex flex-wrap gap-2">
              <Badge color={statusBadgeColor(product.commercialReadiness)}>
                {humanStatus(product.commercialReadiness)}
              </Badge>
              <Badge color={statusBadgeColor(product.compliance)}>
                {humanStatus(product.compliance)}
              </Badge>
              <Badge color={statusBadgeColor(product.status)}>
                {humanStatus(product.status)}
              </Badge>
            </div>
          </section>

          <section className="grid gap-3 rounded border p-4">
            <Heading level="h2">Ações</Heading>
            <label className="flex items-center gap-2">
              <input
                checked={featured}
                onChange={(event) => {
                  setFeatured(event.target.checked);
                  setSaved(false);
                }}
                type="checkbox"
              />
              Produto em destaque
            </label>
            {saved && (
              <Text className="text-ui-fg-success">Rascunho atualizado.</Text>
            )}
            {save.isError && (
              <ErrorState message={adminErrorMessage(save.error)} />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                disabled={!validTitle || save.isPending || uploading}
                onClick={() => {
                  save.mutate();
                }}
              >
                {save.isPending ? "Salvando…" : "SALVAR DRAFT"}
              </Button>
              <a href={`/app/products/${product.id}`}>
                <Button variant="secondary">ABRIR EDIÇÃO COMPLETA</Button>
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const CatalogPage = () => {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<View>("CARDS");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [creating, setCreating] = useState(false);
  const [draftCreated, setDraftCreated] = useState(false);
  const [editing, setEditing] = useState<OperationalProduct | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["achilles-catalog", q, offset],
    queryFn: () =>
      sdk.client.fetch<CatalogData>("/admin/achilles/operations/catalog", {
        query: { q, limit: 24, offset },
      }),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["achilles-catalog"] });
  const duplicate = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/achilles/operations/products/${id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });
  const bulk = useMutation({
    mutationFn: (action: "FEATURE" | "UNFEATURE" | "DEACTIVATE") =>
      sdk.client.fetch("/admin/achilles/operations/products/bulk", {
        method: "POST",
        body: { product_ids: selected, action },
      }),
    onSuccess: async () => {
      setSelected([]);
      await refresh();
    },
  });
  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };
  const products = useMemo(
    () =>
      (query.data?.products ?? []).filter(
        (product) =>
          filter === "ALL" ||
          (filter === "DRAFT" && product.status === "draft") ||
          (filter === "PUBLISHED" && product.status === "published") ||
          (filter === "ATTENTION" && product.attention.length > 0),
      ),
    [query.data, filter],
  );
  return (
    <div className="flex flex-col gap-y-3" data-testid="operations-catalog">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1">Catálogo Comercial</Heading>
            <Text className="text-ui-fg-subtle">
              Produtos próprios da loja e suas fontes de fornecimento, sem
              depender da listagem externa.
            </Text>
          </div>
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            Novo produto
          </Button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder="Buscar por título, SKU ou categoria"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setOffset(0);
            }}
          />
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Filter);
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="ALL">Todos</Select.Item>
              <Select.Item value="DRAFT">Rascunhos</Select.Item>
              <Select.Item value="PUBLISHED">Publicados</Select.Item>
              <Select.Item value="ATTENTION">Precisa de atenção</Select.Item>
            </Select.Content>
          </Select>
          <div className="flex gap-1">
            <Button
              variant={view === "CARDS" ? "primary" : "secondary"}
              onClick={() => {
                setView("CARDS");
              }}
            >
              Cards
            </Button>
            <Button
              variant={view === "TABLE" ? "primary" : "secondary"}
              onClick={() => {
                setView("TABLE");
              }}
            >
              Tabela
            </Button>
          </div>
        </div>
      </Container>
      {draftCreated && (
        <Container>
          <Text>Rascunho criado. Complete os dados antes de publicar.</Text>
        </Container>
      )}
      {selected.length > 0 && (
        <Container>
          <div className="flex flex-wrap items-center gap-2">
            <Text>
              <strong>{selected.length}</strong> selecionado(s)
            </Text>
            <Button
              variant="secondary"
              onClick={() => {
                bulk.mutate("FEATURE");
              }}
            >
              Destacar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                bulk.mutate("UNFEATURE");
              }}
            >
              Remover destaque
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                bulk.mutate("DEACTIVATE");
              }}
            >
              Desativar para DRAFT
            </Button>
            <Text className="text-ui-fg-subtle">
              Publicação, aprovação, compliance, estoque e ofertas não são ações
              em lote.
            </Text>
          </div>
        </Container>
      )}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={String(query.error)} />
      ) : !products.length ? (
        <EmptyState>
          Nenhum produto corresponde aos filtros. Cadastre um DRAFT ou ajuste a
          busca.
        </EmptyState>
      ) : view === "CARDS" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              duplicate={(id) => {
                duplicate.mutate(id);
              }}
              edit={setEditing}
              key={product.id}
              product={product}
              select={toggleSelected}
              selected={selected.includes(product.id)}
            />
          ))}
        </div>
      ) : (
        <Container>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Sel.</th>
                  <th className="p-2">Produto</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Preço</th>
                  <th className="p-2">Fornecedor</th>
                  <th className="p-2">Estoque</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr className="border-b" key={product.id}>
                    <td className="p-2">
                      <input
                        aria-label={`Selecionar ${product.title}`}
                        checked={selected.includes(product.id)}
                        onChange={() => {
                          toggleSelected(product.id);
                        }}
                        type="checkbox"
                      />
                    </td>
                    <td className="p-2">
                      <strong>{product.title}</strong>
                      <br />
                      {product.sku ?? "Sem SKU"}
                    </td>
                    <td className="p-2">
                      <Badge
                        color={statusBadgeColor(product.operationalStatus)}
                      >
                        {humanStatus(product.operationalStatus)}
                      </Badge>
                    </td>
                    <td className="p-2">{money(product.retailPrice)}</td>
                    <td className="p-2">
                      {product.supplier ?? "Não vinculado"}
                    </td>
                    <td className="p-2">{product.stock ?? "Não informado"}</td>
                    <td className="flex gap-1 p-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing(product);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          duplicate.mutate(product.id);
                        }}
                      >
                        Duplicar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      )}
      {query.data && (
        <Container>
          <div className="flex items-center justify-between">
            <Text>{query.data.count} produto(s)</Text>
            <div className="flex gap-2">
              <Button
                disabled={offset === 0}
                variant="secondary"
                onClick={() => {
                  setOffset(Math.max(0, offset - 24));
                }}
              >
                Anterior
              </Button>
              <Button
                disabled={offset + 24 >= query.data.count}
                variant="secondary"
                onClick={() => {
                  setOffset(offset + 24);
                }}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Container>
      )}
      {creating && (
        <QuickCreate
          close={() => {
            setCreating(false);
          }}
          onCreated={() => {
            setDraftCreated(true);
          }}
        />
      )}{" "}
      {editing && (
        <QuickEdit
          close={() => {
            setEditing(null);
          }}
          product={editing}
        />
      )}{" "}
    </div>
  );
};

export const config = defineRouteConfig({ label: "CATÁLOGO · Comercial" });
export default CatalogPage;
