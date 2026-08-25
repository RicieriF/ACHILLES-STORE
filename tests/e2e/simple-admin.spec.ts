import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

const simpleAdmin = "http://localhost:3001";
const evidence = "artifacts/simple-admin";
mkdirSync(evidence, { recursive: true });

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(
    "http://localhost:9000/auth/user/emailpass",
    {
      data: {
        email: "e2e-admin@example.invalid",
        password: "E2eOnly_012_Strong",
      },
    },
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error("Token Admin E2E ausente");
  return body.token;
}

test("Simple Admin supports a non-technical operator draft workflow", async ({
  page,
}) => {
  await page.goto(simpleAdmin);
  await page.getByLabel("E-mail").fill("e2e-admin@example.invalid");
  await page.getByLabel("Senha").fill("E2eOnly_012_Strong");
  await page.getByRole("button", { name: "ENTRAR" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
  await page.screenshot({
    path: `${evidence}/simple-admin-home.png`,
    fullPage: true,
  });

  await page.getByRole("link", { name: "MINHA VITRINE" }).click();
  await expect(
    page.getByRole("heading", { name: "Minha Vitrine" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/simple-admin-showcase.png`,
    fullPage: true,
  });

  await page
    .getByRole("link", { name: "ADICIONAR PRODUTO", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Adicionar Produto" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/simple-admin-add-product.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "BUSCAR PRODUTO" }).click();
  await page.getByLabel("Buscar no CJ").fill("flashlight");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture CJ Flashlight" }),
  ).toBeVisible();
  await expect(page.getByText("Sem foto")).toBeVisible();
  await expect(page.getByText("21 produtos")).toBeVisible();
  await page.getByRole("button", { name: "PRÓXIMA" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture CJ Flashlight Page 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ANTERIOR" }).click();
  await page.getByRole("button", { name: "ADICIONAR" }).click();
  await expect(page.getByText("Rascunho CJ criado.")).toBeVisible();
  await page.getByRole("link", { name: "Abrir Minha Vitrine" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fixture CJ EDC Organizer",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "ADICIONAR PRODUTO", exact: true })
    .click();
  await page.getByRole("button", { name: "CADASTRAR MANUALMENTE" }).click();
  const title = `[E2E] Simple Admin ${Date.now()}`;
  await page.getByLabel("Nome *").fill(title);
  await page.getByLabel("Preço na minha loja (R$)").fill("149.90");
  await page.screenshot({
    path: `${evidence}/simple-admin-product-price.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "SALVAR RASCUNHO" }).click();
  await expect(page.getByText("Rascunho criado.")).toBeVisible();

  await page.getByRole("link", { name: "MINHA VITRINE" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("PRECISA COMPLETAR").first()).toBeVisible();
  await page.screenshot({
    path: `${evidence}/simple-admin-publication-checklist.png`,
    fullPage: true,
  });

  await page.getByRole("link", { name: "PEDIDOS" }).click();
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await page.screenshot({
    path: `${evidence}/simple-admin-orders.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `${evidence}/simple-admin-tracking.png`,
    fullPage: true,
  });

  await page.getByRole("link", { name: "CONFIGURAÇÕES" }).click();
  await expect(
    page.getByRole("heading", { name: "Configurações" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/simple-admin-settings.png`,
    fullPage: true,
  });

  await page.goto("http://localhost:3000");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.screenshot({
    path: `${evidence}/storefront-published-product.png`,
    fullPage: true,
  });
});

test("Simple Admin explains empty and failed CJ searches", async ({ page }) => {
  await page.route(
    "**/api/commerce/admin/achilles/integrations/cj/products?**",
    async (route) => {
      const keyword = new URL(route.request().url()).searchParams.get(
        "keyword",
      );
      if (keyword === "empty") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0, page: 1, size: 20 }),
        });
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "fixture failure" }),
      });
    },
  );
  await page.goto(simpleAdmin);
  await page.getByLabel("E-mail").fill("e2e-admin@example.invalid");
  await page.getByLabel("Senha").fill("E2eOnly_012_Strong");
  await page.getByRole("button", { name: "ENTRAR" }).click();
  await page
    .getByRole("link", { name: "ADICIONAR PRODUTO", exact: true })
    .click();
  await page.getByRole("button", { name: "BUSCAR PRODUTO" }).click();

  await page.getByLabel("Buscar no CJ").fill("empty");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(page.getByText("Nenhum produto encontrado.")).toBeVisible();

  await page.getByLabel("Buscar no CJ").fill("failure");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(
    page.getByText("Não foi possível consultar a CJ. Tente novamente."),
  ).toBeVisible();
});

test("Medusa Admin renders the normalized CJ pages", async ({
  page,
  request,
}) => {
  const token = await adminToken(request);
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${token}` });
  await page.goto("http://localhost:9000/app/achilles-cj-catalog");
  await page.getByPlaceholder("Palavra-chave").fill("flashlight");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "21 produtos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fixture CJ Flashlight" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PRÓXIMA" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture CJ Flashlight Page 2" }),
  ).toBeVisible();
});
