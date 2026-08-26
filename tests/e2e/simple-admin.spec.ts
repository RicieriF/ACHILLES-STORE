import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

const simpleAdmin = "http://localhost:3001";
const evidence = "artifacts/simple-admin";
mkdirSync(evidence, { recursive: true });

async function login(page: import("@playwright/test").Page) {
  await page.goto(simpleAdmin);
  await page.getByLabel("E-mail").fill("e2e-admin@example.invalid");
  await page.getByLabel("Senha").fill("E2eOnly_012_Strong");
  await page.getByRole("button", { name: "ENTRAR" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
}

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
  await page.getByRole("button", { name: "BUSCAR NO CJ" }).click();
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
  await expect(page.getByText("PRODUTO ADICIONADO").first()).toBeVisible();
  await page.getByRole("link", { name: "ABRIR NA MINHA VITRINE" }).click();
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
  await page.getByRole("button", { name: "BUSCAR NO CJ" }).click();

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

test("CJ add reports each stage, completes, and explains duplicate import", async ({
  page,
}) => {
  let importAttempts = 0;
  await page.route(
    "**/api/commerce/admin/achilles/integrations/cj/products?**",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "CJ-STAGED-001",
              title: "Fixture CJ Staged Import",
              image: null,
              priceMin: "9.90",
              priceMax: "12.40",
              currency: "USD",
            },
          ],
          total: 1,
        }),
      }),
  );
  await page.route(
    "**/api/commerce/admin/achilles/integrations/cj/products/CJ-STAGED-001",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          product: {
            id: "CJ-STAGED-001",
            title: "Fixture CJ Staged Import",
            description: "Fixture fiel ao detalhe CJ",
            images: [],
            price: "9.90",
            currency: "USD",
          },
        }),
      });
    },
  );
  await page.route(
    "**/api/commerce/admin/achilles/integrations/cj/variants?**",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          variants: [
            { id: "CJ-STAGED-VID", sku: "CJ-STAGED-SKU", title: "Padrão" },
          ],
        }),
      });
    },
  );
  await page.route(
    "**/api/commerce/admin/achilles/integrations/cj/import",
    async (route) => {
      importAttempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: importAttempts === 1 ? 201 : 409,
        contentType: "application/json",
        body: JSON.stringify(
          importAttempts === 1
            ? { product: { id: "prod_staged" } }
            : importAttempts === 2
              ? {
                  code: "CJ_PRODUCT_ALREADY_IMPORTED",
                  message: "Este produto já está na sua vitrine.",
                  productId: "prod_staged",
                }
              : {
                  code: "SHIPPING_PROFILE_MISSING",
                  message: "Configure um perfil de entrega.",
                },
        ),
      });
    },
  );

  await login(page);
  await page
    .getByRole("link", { name: "ADICIONAR PRODUTO", exact: true })
    .click();
  await page.getByRole("button", { name: "BUSCAR NO CJ" }).click();
  await page.getByLabel("Buscar no CJ").fill("flashlight");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  const importCard = page.locator("article", {
    hasText: "Fixture CJ Staged Import",
  });
  await page.getByRole("button", { name: "ADICIONAR" }).click();
  await expect(
    page.locator(".state", { hasText: "Buscando detalhes..." }),
  ).toBeVisible();
  await expect(
    page.locator(".state", { hasText: "Verificando opções..." }),
  ).toBeVisible();
  await expect(
    page.locator(".state", { hasText: "Criando rascunho..." }),
  ).toBeVisible();
  await expect(page.getByText("PRODUTO ADICIONADO").first()).toBeVisible();
  await expect(importCard.getByText("✓ PRODUTO ADICIONADO")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ABRIR NA MINHA VITRINE" }),
  ).toHaveAttribute("href", "/vitrine?produto=prod_staged");
  await expect(page.getByRole("button", { name: "ADICIONAR" })).toBeEnabled();

  await page.getByRole("button", { name: "ADICIONAR" }).click();
  await expect(
    page.getByText("Este produto já está na sua vitrine."),
  ).toBeVisible();
  await expect(
    importCard.getByText("ESTE PRODUTO JÁ ESTÁ NA VITRINE"),
  ).toBeVisible();
  await page.getByRole("button", { name: "ADICIONAR" }).click();
  await expect(
    importCard.getByText(
      /ERRO: A estrutura de entrega da loja está incompleta/,
    ),
  ).toBeVisible();
  expect(importAttempts).toBe(3);
});

test("Simple Admin remains usable with malformed, offline, and expired responses", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "ADICIONAR PRODUTO", exact: true })
    .click();
  await page.getByRole("button", { name: "BUSCAR NO CJ" }).click();
  await page.route(
    "**/api/commerce/admin/achilles/integrations/cj/products?**",
    async (route) => {
      const keyword = new URL(route.request().url()).searchParams.get(
        "keyword",
      );
      if (keyword === "malformed") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: null, total: null }),
        });
      } else {
        await route.abort("connectionrefused");
      }
    },
  );
  await page.getByLabel("Buscar no CJ").fill("malformed");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(page.getByText("Nenhum produto encontrado.")).toBeVisible();
  await page.getByLabel("Buscar no CJ").fill("offline");
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(
    page.getByText("Não foi possível consultar a CJ. Tente novamente."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "BUSCAR", exact: true }),
  ).toBeEnabled();

  await page.unrouteAll({ behavior: "wait" });
  await page.route(
    "**/api/commerce/admin/achilles/operations/dashboard",
    (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      }),
  );
  await page.goto(`${simpleAdmin}/inicio`);
  await expect(page).toHaveURL(/\/?session=expired$/);
  await expect(
    page.getByText("Sua sessão terminou. Entre novamente."),
  ).toBeVisible();
});

test("manual draft edits persist and safe deletion refreshes without F5", async ({
  page,
}) => {
  const title = `[E2E] Simple edit ${Date.now()}`;
  const updatedTitle = `${title} atualizado`;
  await login(page);
  await page
    .getByRole("link", { name: "ADICIONAR PRODUTO", exact: true })
    .click();
  await page.getByRole("button", { name: "CADASTRAR MANUALMENTE" }).click();
  await page.getByLabel("Nome *").fill(title);
  await page.getByLabel("Preço na minha loja (R$)").fill("119.90");
  await page.getByRole("button", { name: "SALVAR RASCUNHO" }).click();
  await expect(page.getByText("Rascunho criado.")).toBeVisible();
  await page.getByRole("link", { name: "Abrir na vitrine" }).click();
  const card = page.locator("article").filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "EDITAR" }).click();
  await expect(
    page.getByRole("heading", { name: "Editar Produto" }),
  ).toBeVisible();
  await page.getByLabel("Nome *").fill(updatedTitle);
  await page
    .getByLabel("Descrição")
    .fill("Descrição persistida pelo Simple Admin.");
  await page.getByLabel("Preço na minha loja (R$)").fill("129.90");
  await page.getByLabel("SKU").fill(`SKU-${Date.now()}`);
  await page.getByRole("button", { name: "SALVAR", exact: true }).click();
  await expect(page.getByText("Produto salvo.")).toBeVisible();
  await page.getByRole("link", { name: "VOLTAR À VITRINE" }).click();
  const updatedCard = page.locator("article").filter({ hasText: updatedTitle });
  await expect(updatedCard).toContainText("R$ 129,90");
  await expect(updatedCard.getByText("ANTES DE PUBLICAR:")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await updatedCard.getByRole("button", { name: "EXCLUIR" }).click();
  await expect(page.getByText("Produto excluído.")).toBeVisible();
  await expect(page.getByRole("heading", { name: updatedTitle })).toHaveCount(
    0,
  );
});

test("all Simple Admin destinations remain reachable on mobile", async ({
  page,
}) => {
  const unexpectedConsole: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") unexpectedConsole.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const destination of [
    ["MINHA VITRINE", "Minha Vitrine"],
    ["ADICIONAR PRODUTO", "Adicionar Produto"],
    ["PEDIDOS", "Pedidos"],
    ["CLIENTES", "Clientes"],
    ["CONFIGURAÇÕES", "Configurações"],
    ["AVANÇADO", "Avançado"],
  ] as const) {
    await page.getByRole("link", { name: destination[0], exact: true }).click();
    await expect(
      page.getByRole("heading", { name: destination[1], exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "CONFIGURAÇÕES", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "ABRIR CONFIGURAÇÃO AVANÇADA" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(
    page.getByRole("heading", { name: "Organize sua vitrine" }),
  ).toBeVisible();
  expect(unexpectedConsole, "console.error inesperado").toEqual([]);
  expect(pageErrors, "erro não tratado na página").toEqual([]);
});
