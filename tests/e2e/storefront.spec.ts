import { expect, test } from "@playwright/test";

test("storefront presents the visual catalog without production claims", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "ir mais longe",
  );
  await expect(page.locator("article")).toHaveCount(3);
  await expect(
    page.getByText("Demonstração visual com produtos fictícios"),
  ).toBeVisible();
  await expect(page.getByText("Preço em breve")).toBeVisible();
});

test("mobile navigation opens and closes accessibly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).not.toBeVisible();
});

test("product visual foundation is reachable", async ({ page }) => {
  await page.goto("/produto/lanterna-trail-x1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lanterna Trail X1",
  );
  await expect(
    page.getByRole("button", { name: "Adicionar ao carrinho — demonstração" }),
  ).toBeEnabled();
  await expect(page.getByText("Demonstração visual")).toBeVisible();
});
