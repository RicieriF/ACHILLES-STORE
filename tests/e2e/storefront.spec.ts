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

test("guest checkout brasileiro reaches READY_FOR_PAYMENT with recovery and requote", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.locator("article").first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Adicionar à mochila" }).click();
  const cart = page.getByRole("dialog", { name: "Sua mochila" });
  await cart.getByRole("link", { name: "Ir para o checkout" }).click();

  await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
  await page.addStyleTag({
    content: ".skip-link { display: none !important; }",
  });
  await page.screenshot({
    path: "artifacts/task-010/checkout-contato-1440.png",
    fullPage: true,
  });
  await page.getByLabel("Nome completo").fill("Maria da Silva");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("Telefone brasileiro").fill("(27) 99999-9999");
  await page.getByRole("button", { name: "Continuar para entrega" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Endereço de entrega" }),
  ).toBeVisible();
  await page.locator("#checkout-step-heading").focus();
  await page.screenshot({
    path: "artifacts/task-010/checkout-endereco-390.png",
    fullPage: true,
  });
  await page.locator("#postal-code").fill("01310-100");
  await page.getByLabel("Rua / logradouro").fill("Avenida Paulista");
  await page.getByLabel("Número").fill("1000");
  await page.getByLabel("Bairro").fill("Bela Vista");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").selectOption("SP");
  await page.getByRole("button", { name: "Salvar e calcular frete" }).click();

  await expect(
    page.getByRole("heading", { name: "Escolha a entrega" }),
  ).toBeVisible();
  await page.locator("#checkout-step-heading").focus();
  await page.screenshot({
    path: "artifacts/task-010/frete-390.png",
    fullPage: true,
  });
  await page.getByRole("radio", { name: /Entrega Econômica/ }).click();
  await expect(
    page.getByRole("radio", { name: /Entrega Econômica/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Revisar pedido" }),
  ).toBeEnabled();

  await page.reload();
  await page.addStyleTag({
    content: ".skip-link { display: none !important; }",
  });
  await expect(
    page.getByRole("heading", { name: "Revise seu pedido" }),
  ).toBeVisible();
  await page.locator("#checkout-step-heading").focus();
  await page.getByRole("button", { name: /Frete/ }).click();
  await expect(
    page.getByRole("radio", { name: /Entrega Econômica/ }),
  ).toBeChecked();

  await page.getByRole("button", { name: /Entrega/ }).click();
  await page.locator("#postal-code").fill("29216-090");
  await page.getByLabel("Rua / logradouro").fill("Avenida Oceânica");
  await page.getByLabel("Número").fill("42");
  await page.getByLabel("Bairro").fill("Praia do Morro");
  await page.getByLabel("Cidade").fill("Guarapari");
  await page.getByLabel("UF").selectOption("ES");
  await page.getByRole("button", { name: "Salvar e calcular frete" }).click();
  await expect(
    page.getByRole("radio", { name: /Entrega Econômica/ }),
  ).not.toBeChecked();
  await page.getByRole("radio", { name: /Entrega Econômica/ }).click();
  await expect(
    page.getByRole("radio", { name: /Entrega Econômica/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Revisar pedido" }).click();

  await expect(
    page.getByRole("heading", { name: "Revise seu pedido" }),
  ).toBeVisible();
  await expect(
    page.getByText("Não determinado", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/task-010/revisao-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#checkout-step-heading").focus();
  await page.screenshot({
    path: "artifacts/task-010/revisao-1440.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout pronto" }),
  ).toBeVisible();
  await expect(
    page.getByText("Pagamento será habilitado na próxima etapa.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.locator("#checkout-step-heading").focus();
  await page.screenshot({
    path: "artifacts/task-010/ready-for-payment.png",
    fullPage: true,
  });
});

test("checkout create is idempotent for double submit and requires no auth", async ({
  request,
}) => {
  const createdCart = await request.post(
    "http://localhost:9000/achilles/store/carts",
  );
  const { cart } = (await createdCart.json()) as { cart: { id: string } };
  const [left, right] = await Promise.all([
    request.post("http://localhost:9000/achilles/store/checkout", {
      data: { cartId: cart.id },
    }),
    request.post("http://localhost:9000/achilles/store/checkout", {
      data: { cartId: cart.id },
    }),
  ]);
  expect(left.status()).toBe(201);
  expect(right.status()).toBe(201);
  const leftBody = (await left.json()) as { checkout: { id: string } };
  const rightBody = (await right.json()) as { checkout: { id: string } };
  expect(leftBody.checkout.id).toBe(rightBody.checkout.id);
});

test("multi-shipment fixture is explicit and contains no supplier data", async ({
  page,
}) => {
  const expiresAt = new Date(Date.now() + 300_000).toISOString();
  await page.route("**/api/checkout/checkout_fixture", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ checkout: multiShipmentFixture(expiresAt) }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("achilles_cart_id", "cart_fixture");
    localStorage.setItem("achilles_checkout_id", "checkout_fixture");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/checkout");
  await expect(
    page.getByText("Seu pedido será enviado em mais de um pacote."),
  ).toBeVisible();
  await expect(page.getByText("Pacote 1")).toBeVisible();
  await expect(page.getByText("Pacote 2")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Alibaba|SupplierOffer|CJdropshipping/,
  );
  await page.screenshot({
    path: "artifacts/task-010/multi-shipment.png",
    fullPage: true,
  });
});

function multiShipmentFixture(expiresAt: string) {
  const money = (amount: number) => ({
    amount,
    currencyCode: "brl",
    formatted: `R$ ${amount.toFixed(2).replace(".", ",")}`,
  });
  const method = (id: string, amount: number) => ({
    id,
    name: "Entrega Econômica",
    price: money(amount),
    estimatedMinimumDays: 12,
    estimatedMaximumDays: 20,
    trackingSupported: true,
    dutiesNotice: "Tributos ainda não determinados.",
  });
  return {
    id: "checkout_fixture",
    cartId: "cart_fixture",
    status: "SHIPPING",
    customer: {
      name: "Cliente",
      email: "cliente@example.com",
      phone: "+5527999999999",
    },
    address: {
      postalCode: "29216090",
      postalCodeFormatted: "29216-090",
      street: "Rua Teste",
      number: "1",
      complement: null,
      neighborhood: "Centro",
      city: "Guarapari",
      state: "ES",
      countryCode: "BR",
    },
    cart: {
      id: "cart_fixture",
      itemCount: 2,
      subtotal: money(248),
      items: [
        {
          id: "item_1",
          productSlug: "lanterna",
          productTitle: "Lanterna Achilles X1",
          variantTitle: "Padrão",
          variantId: "variant_1",
          thumbnail: null,
          quantity: 1,
          unitPrice: money(149),
          total: money(149),
        },
        {
          id: "item_2",
          productSlug: "acessorio",
          productTitle: "Acessório Outdoor",
          variantTitle: "Padrão",
          variantId: "variant_2",
          thumbnail: null,
          quantity: 1,
          unitPrice: money(99),
          total: money(99),
        },
      ],
    },
    shippingGroups: [
      {
        id: "group-1",
        label: "Pacote 1",
        itemLabels: ["Lanterna Achilles X1"],
        methods: [method("quote-1", 24.9)],
        selectedMethodId: null,
      },
      {
        id: "group-2",
        label: "Pacote 2",
        itemLabels: ["Acessório Outdoor"],
        methods: [method("quote-2", 18.9)],
        selectedMethodId: null,
      },
    ],
    shippingSelections: [],
    shipmentType: "MULTI_SHIPMENT",
    totals: null,
    readiness: { ready: false, reasons: ["SHIPPING_SELECTION_INCOMPLETE"] },
    expiresAt,
    updatedAt: new Date().toISOString(),
    notice: null,
  };
}
