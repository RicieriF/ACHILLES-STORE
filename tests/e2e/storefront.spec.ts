import { expect, test } from "@playwright/test";

test("storefront bootstrap is reachable and honest about its state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Fundação pronta",
  );
  await expect(
    page.getByText("integrações externas como ativas"),
  ).toBeVisible();
});
