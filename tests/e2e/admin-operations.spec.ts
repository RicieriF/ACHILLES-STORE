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
    product_categories: Array<{ id: string }>;
  };
  const categoryId = categories.product_categories[0]?.id;
  if (!categoryId) throw new Error("Categoria E2E ausente");
  const unique = Date.now().toString();
  const title = `[E2E] Produto Operacional ${unique}`;
  const create = await request.post(
    `${commerceUrl}/admin/achilles/operations/products`,
    {
      headers,
      data: {
        title,
        description: "Fixture operacional descartável para validar o Admin.",
        category_id: categoryId,
        image_urls: [],
        price_brl: 129.9,
        sku: `E2E-OPS-${unique}`,
        availability: "UNKNOWN",
        fulfillment_mode: "PRIVATE_LABEL_DROPSHIP",
        variants: [],
        test_fixture: true,
      },
    },
  );
  expect(create.status()).toBe(201);
  const created = (await create.json()) as {
    product: { id: string; status: string };
  };
  expect(created.product.status).toBe("draft");

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
  await expect(card.getByText("COMPLIANCE_HOLD")).toBeVisible();
  await page.screenshot({
    path: `${artifactDirectory}/catalog-cards.png`,
    fullPage: true,
  });

  await card.getByRole("button", { name: "Edição rápida" }).click();
  await expect(
    page.getByRole("heading", { name: "Edição rápida" }),
  ).toBeVisible();
  await expect(page.getByText(/retornam o produto a DRAFT/)).toBeVisible();
  await page.screenshot({ path: `${artifactDirectory}/quick-edit.png` });
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.getByRole("button", { name: "Novo produto" }).click();
  await expect(page.getByTestId("quick-create-panel")).toBeVisible();
  await expect(page.getByText("Etapa 1 de 5")).toBeVisible();
  await expect(
    page.getByText("publicação exige fluxo humano"),
  ).not.toBeVisible();
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
