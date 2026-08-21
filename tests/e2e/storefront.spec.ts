import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

test.describe.configure({ mode: "serial" });
const task15ArtifactDirectory = `artifacts/task-015/run-${String(process.pid)}`;
mkdirSync(task15ArtifactDirectory, { recursive: true });
const evidenceDirectory = `artifacts/e2e-run-${String(process.pid)}`;
mkdirSync(evidenceDirectory, { recursive: true });
const evidencePath = (path: string) =>
  `${evidenceDirectory}/${path.replaceAll(/[\\/]/g, "-")}`;

test("public journey reaches a real Medusa cart", async ({
  page,
}, testInfo) => {
  mkdirSync("artifacts/task-015", { recursive: true });
  const catalogReady = await page.request.get(
    "http://localhost:9000/achilles/store/catalog",
  );
  expect(catalogReady.status()).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "ir mais longe",
  );

  const categoryLink = page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Lanternas" });
  await Promise.all([page.waitForURL(/\/categoria\//), categoryLink.click()]);
  await expect(page.getByRole("heading", { name: "Lanternas" })).toBeVisible();
  const firstProduct = page.locator("article").first();
  await expect(firstProduct).toBeVisible();
  const firstProductLink = firstProduct.getByRole("link").first();
  await expect(firstProductLink).toBeVisible();
  await firstProductLink.click();

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
  await page.screenshot({ path: testInfo.outputPath("cart.png") });
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

test("mobile navigation includes structural categories without exposing private products", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("link", { name: "Lanternas" })).toBeVisible();
  await expect(
    menu.getByRole("link", { name: "Mochilas e Bolsas" }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("link", { name: "EDC", exact: true }),
  ).toBeVisible();
  await expect(menu.getByRole("link", { name: "Cutelaria" })).toBeVisible();
  await expect(
    menu.getByRole("link", { name: "Camping & Outdoor" }),
  ).toBeVisible();
});

test("TASK 013 exposes curated empty category pages without leaking restricted products", async ({
  page,
  request,
}) => {
  await page.goto("/categoria/edc");
  await expect(
    page.getByRole("heading", { name: "Everyday Carry — EDC" }),
  ).toBeVisible();
  await expect(page.getByText("Seleção em preparação")).toBeVisible();
  await page.goto("/categoria/cutelaria");
  await expect(page.getByRole("heading", { name: "Cutelaria" })).toBeVisible();
  await expect(page.getByText("Canivetes")).toBeVisible();
  await expect(page.locator("article.product-card")).toHaveCount(0);
  const restricted = await request.get(
    "http://localhost:9000/achilles/store/products/ficticio-canivete-em-revisao",
  );
  expect(restricted.status()).toBe(404);
});

test("TASK 013 institutional pages and public copy are honest", async ({
  page,
}) => {
  await page.goto("/institucional/privacidade");
  await expect(
    page.getByRole("heading", { name: "Privacidade" }),
  ).toBeVisible();
  await expect(
    page.getByText("Antes do lançamento", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /CNPJ|Alibaba|SupplierOffer/,
  );
});

test("TASK 013 visual evidence at desktop and mobile breakpoints", async ({
  page,
}) => {
  mkdirSync("artifacts/task-013", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/01-home-desktop.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/home-1440.png`,
    fullPage: true,
  });
  await page.locator("header.site-header").screenshot({
    path: `${task15ArtifactDirectory}/header-1440.png`,
  });
  await page.screenshot({
    path: evidencePath("artifacts/task-013/02-hero-header-desktop.png"),
  });
  await page.goto("/categoria/lanternas");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/03-lanternas-desktop.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/lanternas.png`,
    fullPage: true,
  });
  await page.locator("article").first().getByRole("link").first().click();
  await page.screenshot({
    path: evidencePath("artifacts/task-013/04-product-desktop.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/product.png`,
    fullPage: true,
  });
  await page.goto("/categoria/edc");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/05-edc-empty.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/edc-empty.png`,
    fullPage: true,
  });
  await page.goto("/categoria/cutelaria");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/06-cutelaria-compliance.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/cutelaria-restricted.png`,
    fullPage: true,
  });
  await page.goto("/buscar?q=lanterna");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/07-search-desktop.png"),
    fullPage: true,
  });
  await page.goto("/institucional/sobre");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/08-sobre-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: evidencePath("artifacts/task-013/09-home-mobile.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/home-390.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.screenshot({
    path: evidencePath("artifacts/task-013/10-menu-mobile.png"),
  });
  await page.screenshot({ path: `${task15ArtifactDirectory}/menu-mobile.png` });
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

test("guest checkout reaches Pix pending, signed webhook and paid confirmation", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
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
    path: evidencePath("artifacts/task-010/checkout-contato-1440.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/checkout.png`,
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
    path: evidencePath("artifacts/task-010/checkout-endereco-390.png"),
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
    path: evidencePath("artifacts/task-010/frete-390.png"),
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
  const progress = page.getByRole("navigation", {
    name: "Progresso do checkout",
  });
  await progress.getByRole("button", { name: /Frete/ }).click();
  await expect(
    page.getByRole("heading", { name: "Escolha a entrega" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Entrega Econômica/ }),
  ).toBeChecked();

  await progress.getByRole("button", { name: /Entrega/ }).click();
  await expect(
    page.getByRole("heading", { name: "Endereço de entrega" }),
  ).toBeVisible();
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
    page.getByRole("alert").filter({ hasText: "Revise os dados do checkout" }),
  ).toBeVisible();
  await expect(
    page.getByText("Não determinado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Entrega Expressa/ }).click();
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await expect(page.getByText("Incluídos na entrega DDP")).toBeVisible();
  await page.screenshot({
    path: evidencePath("artifacts/task-010/revisao-390.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#checkout-step-heading").focus();
  await page.screenshot({
    path: evidencePath("artifacts/task-010/revisao-1440.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout pronto" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Escolha Pix ou cartão no ambiente de pagamento configurado.",
    ),
  ).toBeVisible();
  await page.locator("#checkout-step-heading").focus();
  await page.screenshot({
    path: evidencePath("artifacts/task-010/ready-for-payment.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
  await page.getByLabel("CPF").fill("529.982.247-25");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/payment") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gerar Pix" }).click();
  const paymentResponse = await responsePromise;
  const paymentBody = (await paymentResponse.json()) as {
    paymentIntent: { id: string; taxpayerIdentityMasked: string | null };
  };
  expect(JSON.stringify(paymentBody)).not.toContain("52998224725");
  expect(paymentBody.paymentIntent.taxpayerIdentityMasked).toBe(
    "***.***.***-25",
  );
  await expect(
    page.getByRole("heading", { name: "Aguardando pagamento" }),
  ).toBeVisible();
  await expect(page.getByLabel("QR Pix de teste não pagável")).toBeVisible();

  const eventId = `evt_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const manifest = `id:${paymentBody.paymentIntent.id.toLowerCase()};request-id:${eventId};ts:${timestamp};`;
  const signature = createHmac("sha256", "playwright_test_webhook_secret_only")
    .update(manifest)
    .digest("hex");
  const invalidWebhook = await request.post(
    "http://localhost:9000/webhooks/test-payment",
    {
      headers: { "x-signature": `ts=${timestamp},v1=${"0".repeat(64)}` },
      data: {
        paymentIntentId: paymentBody.paymentIntent.id,
        status: "PAID",
        eventId,
      },
    },
  );
  expect(invalidWebhook.status()).toBe(401);
  const webhook = await request.post(
    "http://localhost:9000/webhooks/test-payment",
    {
      headers: { "x-signature": `ts=${timestamp},v1=${signature}` },
      data: {
        paymentIntentId: paymentBody.paymentIntent.id,
        status: "PAID",
        eventId,
      },
    },
  );
  expect(webhook.status()).toBe(200);
  const duplicateWebhook = await request.post(
    "http://localhost:9000/webhooks/test-payment",
    {
      headers: { "x-signature": `ts=${timestamp},v1=${signature}` },
      data: {
        paymentIntentId: paymentBody.paymentIntent.id,
        status: "PAID",
        eventId,
      },
    },
  );
  expect(duplicateWebhook.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Pagamento confirmado" }),
  ).toBeVisible({ timeout: 12_000 });
  await expect(
    page.getByText(/nenhuma execução real é automática/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Acompanhar pedido" }),
  ).toHaveAttribute("href", /\/pedido\/ACH-\d{4}-\d{6,}\?token=/);
  await page.screenshot({
    path: `${task15ArtifactDirectory}/confirmation.png`,
    fullPage: true,
  });
});

test("TASK 012 cenário A: paid order, aprovação humana, sandbox e tracking público", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  mkdirSync("artifacts/task-012", { recursive: true });
  const paid = await createPaidOrder(request);
  const auth = await adminAuth(request);
  const headers = { authorization: `Bearer ${auth}` };
  const list = await request.get(
    "http://localhost:9000/admin/achilles/orders",
    { headers },
  );
  expect(list.status()).toBe(200);
  const listed = (await list.json()) as {
    orders: Array<{ id: string; reference: string }>;
  };
  const order = listed.orders.find(
    (candidate) => candidate.reference === paid.reference,
  );
  expect(order).toBeTruthy();
  if (!order) throw new Error("Customer Order não apareceu no Admin");
  const detailBefore = await request.get(
    `http://localhost:9000/admin/achilles/orders/${order.id}`,
    { headers },
  );
  expect(detailBefore.status()).toBe(200);
  expect(await detailBefore.json()).toMatchObject({
    gate: { status: "APPROVAL_REQUIRED" },
    realExecutionEnabled: false,
  });

  await adminLogin(page, auth);
  await page.goto("http://localhost:9000/app/achilles-orders");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pedidos", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByText(paid.reference).click();
  await expect(
    page.getByRole("heading", { name: "Validação do fornecedor" }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath("artifacts/task-012/admin-orders.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: evidencePath("artifacts/task-012/order-detail.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: evidencePath("artifacts/task-012/supplier-order-gate.png"),
    fullPage: true,
  });
  await page.getByRole("checkbox").check();
  await page.screenshot({
    path: evidencePath("artifacts/task-012/approval-confirmation.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "APROVAR PEDIDO AO FORNECEDOR" })
    .click();
  await expect(page.getByText("APPROVED").first()).toBeVisible();
  await page.getByRole("button", { name: "CRIAR PEDIDO TEST/SANDBOX" }).click();
  await page.getByText("Detalhes avançados e auditoria").click();
  await expect(page.getByText(/ACHILLES TEST LOGISTICS/)).toBeVisible();
  await page.screenshot({
    path: evidencePath("artifacts/task-012/sandbox-fulfillment.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "MARCAR TEST SHIPPED" }).click();

  await page.goto(
    `http://localhost:3000/pedido/${paid.reference}?token=${encodeURIComponent(paid.accessToken)}`,
  );
  await expect(
    page.getByRole("heading", { name: `Pedido ${paid.reference}` }),
  ).toBeVisible();
  await expect(page.getByText(/ACHILLES TEST LOGISTICS/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Alibaba|CJ|SupplierOffer|margem|custo do fornecedor/i,
  );
  await page.screenshot({
    path: evidencePath("artifacts/task-012/customer-order.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/customer-order.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: evidencePath("artifacts/task-012/tracking-mobile.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: `${task15ArtifactDirectory}/tracking.png`,
    fullPage: true,
  });
});

test("TASK 012 cenário C: sem estoque apresenta fallback e exige nova aprovação", async ({
  request,
}) => {
  test.setTimeout(240_000);
  const paid = await createPaidOrder(request);
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const detail = await adminOrderByReference(request, headers, paid.reference);
  const group = detail.groups[0];
  if (!group) throw new Error("Fulfillment group ausente");
  const offerId = group.supplier_offer_id;
  try {
    expect(
      (
        await request.post(
          `http://localhost:9000/admin/achilles/offers/${offerId}`,
          { headers, data: { availability: "OUT_OF_STOCK" } },
        )
      ).status(),
    ).toBe(200);
    const blocked = await adminOrderByReference(
      request,
      headers,
      paid.reference,
    );
    expect(blocked.gate.status).toBe("BLOCKED");
    expect(blocked.gate.reasons).toContain("OUT_OF_STOCK");
    const alternativesResponse = await request.get(
      `http://localhost:9000/admin/achilles/orders/${blocked.order.id}/alternatives`,
      { headers },
    );
    const alternatives = (await alternativesResponse.json()) as {
      alternatives: Array<{ offer_id: string }>;
    };
    const alternative = alternatives.alternatives.find(
      (candidate) => candidate.offer_id !== offerId,
    );
    expect(alternative).toBeTruthy();
    if (!alternative) throw new Error("Alternativa não apresentada");
    const selected = await request.post(
      `http://localhost:9000/admin/achilles/orders/${blocked.order.id}/alternative`,
      {
        headers,
        data: { groupId: group.id, offerId: alternative.offer_id },
      },
    );
    expect(selected.status()).toBe(200);
    expect(await selected.json()).toMatchObject({
      plan: { status: "APPROVAL_REQUIRED", approved_at: null },
    });
  } finally {
    await request.post(
      `http://localhost:9000/admin/achilles/offers/${offerId}`,
      { headers, data: { availability: "IN_STOCK" } },
    );
  }
});

test("card double submit is idempotent, decline preserves checkout and retry approves", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await reachPaymentPage(page);
  const checkoutId = await page.evaluate(() =>
    localStorage.getItem("achilles_checkout_id"),
  );
  expect(checkoutId).toBeTruthy();
  const attemptId = crypto.randomUUID();
  const payload = {
    checkoutId,
    method: "CARD",
    attemptId,
    card: {
      token: "tok_test_declined",
      paymentMethodId: "master",
      installments: 1,
    },
  };
  const [first, second] = await Promise.all([
    request.post("http://localhost:9000/achilles/store/payment-intents", {
      data: payload,
    }),
    request.post("http://localhost:9000/achilles/store/payment-intents", {
      data: payload,
    }),
  ]);
  const firstBody = (await first.json()) as {
    paymentIntent: { id: string; status: string };
  };
  const secondBody = (await second.json()) as {
    paymentIntent: { id: string; status: string };
  };
  expect(firstBody.paymentIntent.id).toBe(secondBody.paymentIntent.id);
  expect(JSON.stringify(firstBody)).not.toContain("tok_test_declined");
  await expect
    .poll(
      async () => {
        const current = await request.get(
          `http://localhost:9000/achilles/store/payment-intents/${firstBody.paymentIntent.id}`,
        );
        expect(current.status()).toBe(200);
        const body = (await current.json()) as {
          paymentIntent: { status: string };
        };
        return body.paymentIntent.status;
      },
      { message: "payment intent recusado deve concluir como FAILED" },
    )
    .toBe("FAILED");
  await page.getByRole("tab", { name: "Cartão" }).click();
  await page.getByLabel("Parcelas permitidas pelo fixture").selectOption("2");
  await page.getByRole("button", { name: "Simular cartão recusado" }).click();
  await expect(page.getByText(/Pagamento recusado/).first()).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await page.getByRole("button", { name: "Aprovar cartão de teste" }).click();
  await expect(
    page.getByRole("heading", { name: "Pagamento confirmado" }),
  ).toBeVisible();
  await expect(page.getByText(/Cartão de teste|CARD/)).toBeVisible();
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
    path: evidencePath("artifacts/task-010/multi-shipment.png"),
    fullPage: true,
  });
});

async function reachPaymentPage(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("article").first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Adicionar à mochila" }).click();
  await page
    .getByRole("dialog", { name: "Sua mochila" })
    .getByRole("link", { name: "Ir para o checkout" })
    .click();
  await page.getByLabel("Nome completo").fill("Cliente Teste");
  await page.getByLabel("E-mail").fill("cliente@example.com");
  await page.getByLabel("Telefone brasileiro").fill("(27) 99999-9999");
  await page.getByRole("button", { name: "Continuar para entrega" }).click();
  await page.locator("#postal-code").fill("01310-100");
  await page.getByLabel("Rua / logradouro").fill("Avenida Paulista");
  await page.getByLabel("Número").fill("1000");
  await page.getByLabel("Bairro").fill("Bela Vista");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").selectOption("SP");
  await page.getByRole("button", { name: "Salvar e calcular frete" }).click();
  await page.getByRole("radio", { name: /Entrega Expressa/ }).click();
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await page.getByRole("link", { name: "Ir para pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
}

type Task12AdminDetail = {
  order: { id: string; reference: string };
  plan: { status: string; approved_at: string | null } | null;
  groups: Array<{ id: string; supplier_offer_id: string }>;
  gate: { status: string; reasons: string[] };
  supplierOrders: unknown[];
};

async function createPaidOrder(request: APIRequestContext): Promise<{
  reference: string;
  accessToken: string;
  paymentIntentId: string;
}> {
  const commerce = "http://localhost:9000";
  const catalog = await request.get(`${commerce}/achilles/store/catalog`);
  const catalogBody = (await catalog.json()) as {
    products: Array<{ variants: Array<{ id: string }> }>;
  };
  const variantId = catalogBody.products[0]?.variants[0]?.id;
  if (!variantId) throw new Error("Variante pública ausente");
  const cartResponse = await request.post(`${commerce}/achilles/store/carts`);
  const { cart } = (await cartResponse.json()) as { cart: { id: string } };
  expect(
    (
      await request.post(`${commerce}/achilles/store/carts/${cart.id}/items`, {
        data: { variantId, quantity: 1 },
      })
    ).status(),
  ).toBe(200);
  const checkoutResponse = await request.post(
    `${commerce}/achilles/store/checkout`,
    { data: { cartId: cart.id } },
  );
  const checkoutBody = (await checkoutResponse.json()) as {
    checkout: { id: string };
  };
  const checkoutId = checkoutBody.checkout.id;
  await request.patch(
    `${commerce}/achilles/store/checkout/${checkoutId}/customer`,
    {
      data: {
        name: "Cliente Sandbox",
        email: "sandbox@example.com",
        phone: "(27) 99999-9999",
      },
    },
  );
  await request.patch(
    `${commerce}/achilles/store/checkout/${checkoutId}/address`,
    {
      data: {
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1000",
        complement: null,
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        countryCode: "BR",
      },
    },
  );
  const quoteResponse = await request.post(
    `${commerce}/achilles/store/checkout/${checkoutId}/shipping/quote`,
  );
  const quoteBody = (await quoteResponse.json()) as {
    checkout: {
      shippingGroups: Array<{
        id: string;
        methods: Array<{ id: string; name: string }>;
      }>;
    };
  };
  for (const group of quoteBody.checkout.shippingGroups) {
    const method =
      group.methods.find((candidate) => /Expressa/.test(candidate.name)) ??
      group.methods[0];
    if (!method) throw new Error("Método DDP de teste ausente");
    const selected = await request.post(
      `${commerce}/achilles/store/checkout/${checkoutId}/shipping/select`,
      { data: { groupId: group.id, quoteId: method.id } },
    );
    expect(selected.status()).toBe(200);
  }
  expect(
    (
      await request.get(
        `${commerce}/achilles/store/checkout/${checkoutId}/review`,
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(
        `${commerce}/achilles/store/checkout/${checkoutId}/ready`,
      )
    ).status(),
  ).toBe(200);
  const paymentResponse = await request.post(
    `${commerce}/achilles/store/payment-intents`,
    {
      data: {
        checkoutId,
        method: "PIX",
        attemptId: crypto.randomUUID(),
        cpf: "529.982.247-25",
      },
    },
  );
  if (paymentResponse.status() !== 201)
    throw new Error(
      `Payment fixture failed (${String(paymentResponse.status())}): ${await paymentResponse.text()}`,
    );
  const payment = (await paymentResponse.json()) as {
    paymentIntent: { id: string };
  };
  const eventId = `evt_task12_${crypto.randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const manifest = `id:${payment.paymentIntent.id.toLowerCase()};request-id:${eventId};ts:${timestamp};`;
  const signature = createHmac("sha256", "playwright_test_webhook_secret_only")
    .update(manifest)
    .digest("hex");
  const event = {
    headers: { "x-signature": `ts=${timestamp},v1=${signature}` },
    data: {
      paymentIntentId: payment.paymentIntent.id,
      status: "PAID",
      eventId,
    },
  };
  expect(
    (await request.post(`${commerce}/webhooks/test-payment`, event)).status(),
  ).toBe(200);
  expect(
    (await request.post(`${commerce}/webhooks/test-payment`, event)).status(),
  ).toBe(200);
  const status = await request.get(
    `${commerce}/achilles/store/payment-intents/${payment.paymentIntent.id}`,
  );
  const statusBody = (await status.json()) as {
    paymentIntent: {
      customerOrder: { reference: string; accessToken: string } | null;
    };
  };
  if (!statusBody.paymentIntent.customerOrder)
    throw new Error("Customer Order não criado para pagamento PAID");
  return {
    ...statusBody.paymentIntent.customerOrder,
    paymentIntentId: payment.paymentIntent.id,
  };
}

async function adminAuth(request: APIRequestContext): Promise<string> {
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

async function adminOrderByReference(
  request: APIRequestContext,
  headers: Record<string, string>,
  reference: string,
): Promise<Task12AdminDetail> {
  const list = await request.get(
    "http://localhost:9000/admin/achilles/orders",
    { headers },
  );
  const body = (await list.json()) as {
    orders: Array<{ id: string; reference: string }>;
  };
  const summary = body.orders.find((order) => order.reference === reference);
  if (!summary) throw new Error("Pedido não listado no Admin");
  const detail = await request.get(
    `http://localhost:9000/admin/achilles/orders/${summary.id}`,
    { headers },
  );
  expect(detail.status()).toBe(200);
  return (await detail.json()) as Task12AdminDetail;
}

async function adminLogin(page: Page, token: string): Promise<void> {
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${token}` });
}

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

test("TASK 012 cenário B: aumento de custo bloqueia execução e aparece no Admin", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  mkdirSync("artifacts/task-012", { recursive: true });
  const paid = await createPaidOrder(request);
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const detail = await adminOrderByReference(request, headers, paid.reference);
  const group = detail.groups[0];
  if (!group) throw new Error("Fulfillment group ausente");
  const offerId = group.supplier_offer_id;
  const offerResponse = await request.get(
    `http://localhost:9000/admin/achilles/offers/${offerId}`,
    { headers },
  );
  const offerBody = (await offerResponse.json()) as {
    offer: { unit_cost: string };
  };
  const original = offerBody.offer.unit_cost;
  try {
    const changed = (Number(original) + 3).toFixed(2);
    expect(
      (
        await request.post(
          `http://localhost:9000/admin/achilles/offers/${offerId}`,
          { headers, data: { unit_cost: changed } },
        )
      ).status(),
    ).toBe(200);
    const blocked = await adminOrderByReference(
      request,
      headers,
      paid.reference,
    );
    expect(blocked.gate).toMatchObject({ status: "REVIEW_REQUIRED" });
    expect(blocked.gate.reasons).toContain("PRICE_CHANGED");
    expect(blocked.supplierOrders).toHaveLength(0);
    await adminLogin(page, token);
    await page.goto("http://localhost:9000/app/achilles-orders");
    await page.getByText(paid.reference).click();
    await expect(
      page.getByText("Custo do fornecedor mudou desde a venda."),
    ).toBeVisible();
    await page.screenshot({
      path: evidencePath("artifacts/task-012/exception-state.png"),
      fullPage: true,
    });
  } finally {
    await request.post(
      `http://localhost:9000/admin/achilles/offers/${offerId}`,
      { headers, data: { unit_cost: original } },
    );
  }
});

test("TASK 014 staging-like mantém fluxo público e expõe Integration Hub autenticado", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  mkdirSync("artifacts/task-014", { recursive: true });

  const storefrontHealth = await request.get(
    "http://localhost:3000/api/health",
  );
  expect(storefrontHealth.status()).toBe(200);
  expect(storefrontHealth.headers()["x-content-type-options"]).toBe("nosniff");
  expect(storefrontHealth.headers()["x-frame-options"]).toBe("DENY");

  const anonymous = await request.get(
    "http://localhost:9000/admin/achilles/integrations",
  );
  expect(anonymous.status()).toBe(401);

  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const response = await request.get(
    "http://localhost:9000/admin/achilles/integrations",
    { headers },
  );
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    integrations: Array<{
      id: string;
      status: string;
      configured: Record<string, boolean>;
      capabilities: Record<string, boolean>;
    }>;
  };
  expect(data.integrations.find((item) => item.id === "cj")).toMatchObject({
    status: "CONFIGURED",
    configured: { testMode: true },
    capabilities: { orderCreate: false, orderPay: false },
  });
  expect(
    data.integrations.find((item) => item.id === "alibaba")?.capabilities,
  ).toMatchObject({ orderCreate: false, orderPay: false });
  expect(JSON.stringify(data)).not.toMatch(
    /MERCADO_PAGO_ACCESS_TOKEN|ALIBABA_APP_SECRET|RESEND_API_KEY/,
  );

  await adminLogin(page, token);
  await page.goto("http://localhost:9000/app/achilles-integrations");
  await expect(page.getByTestId("integration-hub")).toBeVisible();
  await expect(page.getByTestId("integration-cj")).toContainText("CONFIGURED");
  await page.screenshot({
    path: evidencePath("artifacts/task-014/integration-hub.png"),
    fullPage: true,
  });
  await page.getByTestId("health-dashboard").screenshot({
    path: evidencePath("artifacts/task-014/health.png"),
  });
  await page.getByTestId("integration-mercado-pago").screenshot({
    path: evidencePath("artifacts/task-014/mercado-pago-status.png"),
  });
  await page.getByTestId("integration-cj").screenshot({
    path: evidencePath("artifacts/task-014/cj-status.png"),
  });

  await page.goto("http://localhost:9000/app/achilles-settings");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.screenshot({
    path: evidencePath("artifacts/task-014/settings.png"),
    fullPage: true,
  });

  await page.goto("http://localhost:9000/app/achilles-brazil-stock");
  await expect(page.getByTestId("brazil-stock-page")).toBeVisible();
  await page.screenshot({
    path: evidencePath("artifacts/task-014/brazil-stock.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: evidencePath("artifacts/task-014/mobile-storefront-staging.png"),
    fullPage: true,
  });
});
