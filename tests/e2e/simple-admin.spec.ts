import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const simpleAdmin = "http://localhost:3001";
const evidence = "artifacts/simple-admin";
mkdirSync(evidence, { recursive: true });

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
