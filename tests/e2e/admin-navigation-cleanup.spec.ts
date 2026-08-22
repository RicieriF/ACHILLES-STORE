import { mkdirSync } from "node:fs";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const commerceUrl = "http://localhost:9000";
const evidenceDirectory = "artifacts/task-016-1";

async function adminToken(request: APIRequestContext): Promise<string> {
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

async function expectOperationalNavigation(page: Page): Promise<void> {
  for (const label of [
    "INÍCIO",
    "PRODUTOS",
    "IMPORTAR",
    "PEDIDOS",
    "CONFIGURAÇÕES",
    "AVANÇADO",
  ])
    await expect(
      page.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  await expect(page.getByText(/AVANÇADO ·/)).toHaveCount(0);
}

test("Admin navigation cleanup keeps daily routes simple and advanced tools accessible", async ({
  page,
  request,
}) => {
  mkdirSync(evidenceDirectory, { recursive: true });
  const token = await adminToken(request);
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${token}` });

  await page.goto(`${commerceUrl}/app/achilles`);
  await expectOperationalNavigation(page);
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-sidebar-clean.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `${evidenceDirectory}/admin-home-clean.png`,
    fullPage: true,
  });

  await page.goto(`${commerceUrl}/app/achilles-catalog`);
  await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-products-clean.png`,
    fullPage: true,
  });

  await page.goto(`${commerceUrl}/app/achilles-orders`);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-orders-clean.png`,
    fullPage: true,
  });

  await page.goto(`${commerceUrl}/app/achilles-advanced`);
  await expect(page.getByTestId("advanced-page")).toBeVisible();
  await expect(page.getByRole("link", { name: /Fornecedores/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Integrações/ })).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-advanced.png`,
    fullPage: true,
  });
});
