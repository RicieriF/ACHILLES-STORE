import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

const commerceUrl = "http://localhost:9000";
const artifactDirectory = "artifacts/admin-dropshipping-ops";

async function adminAuth(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${commerceUrl}/auth/user/emailpass`, {
    data: {
      email: "e2e-admin@example.invalid",
      password: "E2eOnly_012_Strong",
    },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error("Token Admin E2E ausente");
  return body.token;
}

async function createQuickDraft(
  request: APIRequestContext,
  headers: Record<string, string>,
  data: Record<string, unknown>,
) {
  return request.post(`${commerceUrl}/admin/achilles/operations/products`, {
    headers,
    data: { ...data, test_fixture: true },
  });
}

test("Quick Create accepts incomplete drafts while publication stays gated", async ({
  request,
}) => {
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const unique = Date.now().toString();
  const cases = [
    { title: `[E2E] Draft apenas título ${unique}` },
    {
      title: `[E2E] Draft título e imagem ${unique}`,
      image_urls: ["https://example.invalid/achilles-draft.png"],
    },
    {
      title: `[E2E] Draft preço sem fornecedor ${unique}`,
      price_brl: 79.9,
    },
  ];
  const createdIds: string[] = [];
  for (const draft of cases) {
    const response = await createQuickDraft(request, headers, draft);
    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      product: { id: string; status: string };
      policy: { compliance_status: string; commercial_readiness: string };
      offerId: string | null;
    };
    expect(body.product.status).toBe("draft");
    expect(body.policy.compliance_status).toBe("PENDING");
    expect(body.policy.commercial_readiness).toBe("DATA_INCOMPLETE");
    expect(body.offerId).toBeNull();
    createdIds.push(body.product.id);
  }

  const invalid = await createQuickDraft(request, headers, {});
  expect(invalid.status()).toBe(400);

  const publicCatalog = await request.get(
    `${commerceUrl}/achilles/store/catalog`,
  );
  expect(publicCatalog.status()).toBe(200);
  const publicBody = JSON.stringify(await publicCatalog.json());
  for (const id of createdIds) expect(publicBody).not.toContain(id);
});

test("Supplier Hub consulta fixture CJ e salva produto como DRAFT", async ({
  request,
}) => {
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const connection = await request.post(
    `${commerceUrl}/admin/achilles/integrations/cj/test`,
    { headers },
  );
  expect(connection.status()).toBe(200);
  expect((await connection.json()) as { connected: boolean }).toMatchObject({
    connected: true,
  });
  const search = await request.get(
    `${commerceUrl}/admin/achilles/integrations/cj/products?keyword=organizer`,
    { headers },
  );
  expect(search.status()).toBe(200);
  expect(JSON.stringify(await search.json())).toContain("CJ-FIXTURE-001");
  const details = await request.get(
    `${commerceUrl}/admin/achilles/integrations/cj/products/CJ-FIXTURE-001`,
    { headers },
  );
  expect(details.status()).toBe(200);
  const cjImportId = Date.now().toString();
  const imported = await request.post(
    `${commerceUrl}/admin/achilles/integrations/cj/import`,
    {
      headers,
      data: {
        pid: `CJ-FIXTURE-${cjImportId}`,
        title: `[E2E] Fixture CJ EDC Organizer ${cjImportId}`,
        description: "Fixture autorizada somente em APP_ENV=test.",
        images: [],
        sourceUrl: "https://fixture.invalid/product/CJ-FIXTURE-001",
        currency: "USD",
        sourceCost: "12.50",
        variants: [
          {
            vid: "CJ-FIXTURE-VID",
            sku: `CJ-FIXTURE-${cjImportId}`,
            title: "Black",
          },
        ],
        warehouse: "China Warehouse",
      },
    },
  );
  const importedBody = (await imported.json()) as {
    product?: { status: string };
    isPrimary?: boolean;
    message?: string;
    issues?: unknown;
  };
  expect(imported.status(), JSON.stringify(importedBody)).toBe(201);
  expect(importedBody).toMatchObject({
    product: { status: "draft" },
    isPrimary: false,
  });
});

test("Alibaba fixture valida APIs oficiais sem fingir conexão real", async ({
  request,
}) => {
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const connection = await request.post(
    `${commerceUrl}/admin/achilles/integrations/alibaba/test`,
    { headers },
  );
  expect(connection.status()).toBe(200);
  expect(await connection.json()).toMatchObject({
    connected: true,
    capabilities: { productLookup: true, orderCreate: false, orderPay: false },
  });
  const hub = await request.get(`${commerceUrl}/admin/achilles/integrations`, {
    headers,
  });
  const integrations = (
    (await hub.json()) as {
      integrations: Array<{ id: string; status: string }>;
    }
  ).integrations;
  expect(integrations.find((item) => item.id === "alibaba")?.status).not.toBe(
    "CONNECTED",
  );
  const detail = await request.get(
    `${commerceUrl}/admin/achilles/integrations/alibaba/products/123456`,
    { headers },
  );
  expect(detail.status()).toBe(200);
  expect(await detail.json()).toMatchObject({
    product: { id: "123456", title: "Fixture Alibaba EDC" },
  });
  const freight = await request.post(
    `${commerceUrl}/admin/achilles/integrations/alibaba/freight`,
    {
      headers,
      data: {
        productId: "123456",
        quantity: 1,
        zipCode: "01310100",
        dispatchLocation: "CN",
      },
    },
  );
  expect(freight.status()).toBe(200);
  expect(await freight.json()).toMatchObject({
    quotes: [{ method: "Fixture Express", currency: "USD" }],
  });
});

test("Admin dropshipping operations center uses real operational data", async ({
  page,
  request,
}) => {
  mkdirSync(artifactDirectory, { recursive: true });
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const categoriesResponse = await request.get(
    `${commerceUrl}/admin/product-categories?limit=1`,
    { headers },
  );
  expect(categoriesResponse.status()).toBe(200);
  const categories = (await categoriesResponse.json()) as {
    product_categories: Array<{ id: string; name: string }>;
  };
  const category = categories.product_categories[0];
  if (!category) throw new Error("Categoria E2E ausente");
  const unique = Date.now().toString();
  const title = `[E2E] Produto Operacional ${unique}`;
  const create = await createQuickDraft(request, headers, { title });
  expect(create.status()).toBe(201);
  const created = (await create.json()) as {
    product: { id: string; status: string };
    policy: { compliance_status: string };
  };
  expect(created.product.status).toBe("draft");
  expect(created.policy.compliance_status).toBe("PENDING");

  await page.setExtraHTTPHeaders(headers);
  await page.goto(`${commerceUrl}/app/achilles`);
  await expect(page.getByTestId("operations-dashboard")).toBeVisible();
  await expect(
    page.getByText("Central de Operações Dropshipping"),
  ).toBeVisible();
  await page.screenshot({
    path: `${artifactDirectory}/dashboard.png`,
    fullPage: true,
  });

  await page.goto(`${commerceUrl}/app/achilles-catalog`);
  await expect(page.getByTestId("operations-catalog")).toBeVisible();
  await page
    .getByPlaceholder("Buscar por título, SKU ou categoria")
    .fill(title);
  const card = page
    .getByTestId("catalog-product-card")
    .filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByText("Pendente de revisão")).toBeVisible();
  await page.screenshot({
    path: `${artifactDirectory}/catalog-cards.png`,
    fullPage: true,
  });

  await card.getByRole("button", { name: "Edição rápida" }).click();
  await expect(
    page.getByRole("heading", { name: "Edição rápida" }),
  ).toBeVisible();
  const quickEdit = page.getByTestId("quick-edit-panel");
  await expect(page.getByText(/retornam o produto a DRAFT/)).toBeVisible();
  await expect(quickEdit.getByLabel("Título")).toHaveValue(title);
  const categorySelect = quickEdit.getByRole("combobox", {
    name: "Categoria",
  });
  await expect(categorySelect).toBeEnabled();
  await categorySelect.click();
  await page.getByRole("option", { name: category.name }).click();
  await expect(quickEdit.getByText("Sem imagem")).toBeVisible();
  await expect(quickEdit.getByLabel("Preço de venda")).toHaveValue("");
  await expect(quickEdit.getByText("Custo atual")).toBeVisible();
  await expect(quickEdit.getByText("Margem estimada")).toBeVisible();
  await expect(
    quickEdit.getByRole("combobox", { name: "Disponibilidade" }),
  ).toBeVisible();
  await expect(quickEdit.getByText("Estoque não gerenciado")).toBeVisible();
  await expect(quickEdit.getByText("Fornecedor não vinculado")).toBeVisible();
  await expect(quickEdit.getByText("Cadastro incompleto")).toBeVisible();
  await expect(quickEdit.getByText("Compliance pendente")).toBeVisible();
  await expect(quickEdit.getByText("Rascunho", { exact: true })).toBeVisible();
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await quickEdit.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  await quickEdit.getByLabel("Título").fill(`${title} atualizado`);
  await quickEdit.getByRole("button", { name: "SALVAR DRAFT" }).click();
  await expect(quickEdit.getByText("Rascunho atualizado.")).toBeVisible();
  const updated = await request.get(
    `${commerceUrl}/admin/achilles/operations/catalog/${created.product.id}`,
    { headers },
  );
  expect(updated.status()).toBe(200);
  const updatedBody = (await updated.json()) as {
    product: { status: string; categoryId: string | null };
  };
  expect(updatedBody.product.status).toBe("draft");
  expect(updatedBody.product.categoryId).toBe(category.id);
  const afterSaveCatalog = await request.get(
    `${commerceUrl}/achilles/store/catalog`,
  );
  expect(JSON.stringify(await afterSaveCatalog.json())).not.toContain(
    created.product.id,
  );
  await page.screenshot({ path: `${artifactDirectory}/quick-edit.png` });
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.getByRole("button", { name: "Novo produto" }).click();
  await expect(page.getByTestId("quick-create-panel")).toBeVisible();
  await expect(page.getByText("Etapa 1 de 5")).toBeVisible();
  for (let step = 1; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continuar" }).click();
  }
  await expect(
    page.getByRole("button", { name: "SALVAR DRAFT" }),
  ).toBeDisabled();
  for (let step = 5; step > 1; step -= 1) {
    await page.getByRole("button", { name: "Voltar" }).click();
  }
  await page
    .getByTestId("quick-create-panel")
    .getByPlaceholder("Título")
    .fill("Rascunho mínimo");
  for (let step = 1; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continuar" }).click();
  }
  await expect(page.getByText("⚠ Sem imagem")).toBeVisible();
  await expect(page.getByText("⚠ Preço não informado")).toBeVisible();
  await expect(page.getByText("⚠ SKU ausente")).toBeVisible();
  await expect(page.getByText("⚠ Fornecedor não vinculado")).toBeVisible();
  await expect(page.getByText("⚠ Compliance pendente")).toBeVisible();
  await expect(page.getByText("DRAFT · incompleto")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "SALVAR DRAFT" }),
  ).toBeEnabled();
  await page.screenshot({ path: `${artifactDirectory}/quick-create.png` });
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.goto(`${commerceUrl}/app/products/${created.product.id}`);
  await expect(page.getByTestId("product-operations-widget")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operação ACHILLES" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${artifactDirectory}/product-operations.png`,
    fullPage: true,
  });

  await page.goto(`${commerceUrl}/app/achilles-extensions`);
  await expect(page.getByTestId("extensions-page")).toBeVisible();
  await expect(page.getByText("Extensões e Serviços")).toBeVisible();
  await expect(page.getByText("ShipStation")).toBeVisible();
  await page.screenshot({
    path: `${artifactDirectory}/extensions.png`,
    fullPage: true,
  });
});
