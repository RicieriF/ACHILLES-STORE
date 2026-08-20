import { expect, test } from "@playwright/test";

test("public journey reaches a real Medusa cart", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "ir mais longe",
  );

  const categoryLink = page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Iluminação" });
  await Promise.all([page.waitForURL(/\/categoria\//), categoryLink.click()]);
  await expect(page.getByRole("heading", { name: "Iluminação" })).toBeVisible();
  await page.locator("article").first().getByRole("link").first().click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Lanterna de Desenvolvimento",
  );
  await expect(
    page.getByRole("group", { name: "Escolha uma variante" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar à mochila" }).click();

  const cart = page.getByRole("dialog", { name: "Sua mochila" });
  await expect(cart).toBeVisible();
  await expect(cart.getByText("R$ 149,00").last()).toBeVisible();
  await cart.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(cart.getByRole("status", { name: "" })).toHaveText("2");
  await expect(cart.getByText("R$ 298,00")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Abrir carrinho" }),
  ).toContainText("2");
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await page
    .getByRole("dialog", { name: "Sua mochila" })
    .getByRole("button", { name: "Remover" })
    .click();
  await expect(page.getByText("Sua mochila está vazia.")).toBeVisible();
});

test("search returns public content without sourcing data", async ({
  page,
}) => {
  await page.goto("/buscar?q=lanterna");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText("Alibaba");
  await expect(page.locator("body")).not.toContainText("SupplierOffer");
  await page.goto("/buscar?q=produto%20privado");
  await expect(page.getByText("Nenhum resultado")).toBeVisible();
});

test("private product is rejected by the public API and hidden by the storefront", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "http://localhost:9000/achilles/store/products/ficticio-mochila-desenvolvimento",
  );
  expect(response.status()).toBe(404);

  await page.goto("/produto/ficticio-mochila-desenvolvimento");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).not.toHaveCount(0);
});

test("mobile navigation uses the same dynamic category list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("link", { name: "Iluminação" })).toBeVisible();
  await expect(
    menu.getByRole("link", { name: "Mochilas e Bolsas" }),
  ).toHaveCount(0);
});

test("sitemap contains only eligible public catalog URLs", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("ficticio-lanterna-desenvolvimento");
  expect(body).not.toContain("ficticio-mochila-desenvolvimento");
  expect(body).not.toContain("design-system");
});
