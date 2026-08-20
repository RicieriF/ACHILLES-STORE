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
  await page.getByRole("textbox", { name: "CEP" }).fill("01310-100");
  await page.getByRole("button", { name: "CALCULAR" }).click();
  const shipping = page.getByRole("group", { name: "Opções de entrega" });
  await expect(
    shipping.getByRole("radio", { name: /Entrega Econômica/ }),
  ).toBeChecked();
  await shipping.getByRole("radio", { name: /Entrega Expressa/ }).check();
  await expect(
    shipping.getByRole("radio", { name: /Entrega Expressa/ }),
  ).toBeChecked();
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

test("public shipping API validates input and sanitizes sourcing data", async ({
  request,
}) => {
  const catalog = await request.get(
    "http://localhost:9000/achilles/store/catalog",
  );
  const payload = (await catalog.json()) as {
    products: Array<{ variants: Array<{ id: string }> }>;
  };
  const variantId = payload.products[0]?.variants[0]?.id;
  expect(variantId).toBeTruthy();
  const response = await request.post(
    "http://localhost:9000/achilles/store/shipping/quote",
    { data: { variantId, quantity: 1, postalCode: "01310-100" } },
  );
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Entrega Econômica");
  expect(body).not.toMatch(
    /Alibaba|SupplierOffer|supplierOfferId|supplierUnitCost|providerReference|source_url/,
  );

  const rejected = await request.post(
    "http://localhost:9000/achilles/store/shipping/quote",
    {
      data: {
        variantId,
        quantity: 1,
        postalCode: "01310-100",
        supplierOfferId: "supoff_private",
      },
    },
  );
  expect(rejected.status()).toBe(400);
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
  await expect(
    menu.getByRole("link", { name: "Everyday Carry — EDC" }),
  ).toHaveCount(0);
});

test("official brand assets adapt between desktop and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const desktopLogo = page.locator(".brand-link__desktop img");
  const mobileLogo = page.locator(".brand-link__mobile img");
  await expect(desktopLogo).toBeVisible();
  await expect(desktopLogo).toHaveAttribute(
    "src",
    /achilles-store-horizontal\.svg/,
  );
  await expect(mobileLogo).toBeHidden();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /brand\/favicon\.svg/,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(desktopLogo).toBeHidden();
  await expect(mobileLogo).toBeVisible();
  await expect(mobileLogo).toHaveAttribute("src", /achilles-store-symbol\.svg/);
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
