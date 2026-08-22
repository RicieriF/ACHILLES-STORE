import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

const commerceUrl = "http://localhost:9000";
const evidenceDirectory = "artifacts/task-016-2";
mkdirSync(evidenceDirectory, { recursive: true });

async function adminAuth(request: APIRequestContext): Promise<string> {
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

test("operational import price publish and tracking stay on Achilles pages", async ({
  page,
  request,
}) => {
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const unique = Date.now().toString();
  writeFileSync(`${evidenceDirectory}/run-marker.txt`, unique, "utf8");
  const title = `[E2E] Operacional ${unique}`;
  const sourceUrl = `https://www.aliexpress.com/item/${unique}.html`;

  const created = await request.post(`${commerceUrl}/admin/achilles/imports`, {
    headers,
    data: { source_url: sourceUrl },
  });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()) as { draft: { id: string } };
  const draftId = createdBody.draft.id;
  expect(
    (
      await request.patch(`${commerceUrl}/admin/achilles/imports/${draftId}`, {
        headers,
        data: {
          title_normalized: title,
          description_normalized: "Rascunho operacional de fixture.",
          source_currency: "USD",
          source_price_min: "8.50",
          category_suggested: "Lanternas",
          media: ["https://example.invalid/operational-product.png"],
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(
        `${commerceUrl}/admin/achilles/imports/${draftId}/approve`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  const converted = await request.post(
    `${commerceUrl}/admin/achilles/imports/${draftId}/convert`,
    { headers },
  );
  expect(converted.status()).toBe(201);
  const conversion = (await converted.json()) as {
    conversion: { product_id: string };
  };
  const productId = conversion.conversion.product_id;

  await page.setExtraHTTPHeaders(headers);
  await page.goto(`${commerceUrl}/app/achilles-imports`);
  await expect(
    page.getByRole("heading", { name: "Importar produto" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-import-simple.png`,
    fullPage: true,
  });

  await page.goto(
    `${commerceUrl}/app/achilles-catalog?q=${encodeURIComponent(title)}`,
  );
  await expect(
    page.getByTestId("catalog-product-card").filter({ hasText: title }),
  ).toBeVisible();
  const card = page
    .getByTestId("catalog-product-card")
    .filter({ hasText: title });
  await expect(card.getByRole("button", { name: "Publicar" })).toBeDisabled();
  await expect(card.getByText("Defina o preço")).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-publication-checklist.png`,
    fullPage: true,
  });

  const priced = await request.post(
    `${commerceUrl}/admin/achilles/operations/products/${productId}`,
    { headers, data: { price_brl: 189.9, title } },
  );
  expect(priced.status()).toBe(200);
  const published = await request.post(
    `${commerceUrl}/admin/achilles/operations/products/${productId}/publish`,
    { headers },
  );
  expect(published.status(), await published.text()).toBe(200);

  await page.goto(
    `${commerceUrl}/app/achilles-catalog?q=${encodeURIComponent(title)}`,
  );
  await card.getByRole("button", { name: "Edição rápida" }).click();
  await expect(page.getByLabel("Preço de venda")).toHaveValue("189.9");
  await page.screenshot({
    path: `${evidenceDirectory}/admin-product-price.png`,
  });
  await page.getByRole("button", { name: "Fechar" }).click();

  const catalog = await request.get(`${commerceUrl}/achilles/store/catalog`);
  const catalogBody = (await catalog.json()) as {
    products: Array<{ title: string; handle?: string; slug?: string }>;
  };
  expect(JSON.stringify(catalogBody)).toContain(title);
  const publishedProduct = catalogBody.products.find((item) =>
    item.title.includes(unique),
  );
  const handle = publishedProduct?.handle ?? publishedProduct?.slug;
  expect(handle).toBeTruthy();
  await page.goto(`http://localhost:3000/produto/${handle}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  await page.screenshot({
    path: `${evidenceDirectory}/storefront-published-product.png`,
    fullPage: true,
  });

  await page.goto(`${commerceUrl}/app/achilles`);
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-home-real-clean.png`,
    fullPage: true,
  });
});

test("paid fixture order can be approved and tracked without sandbox buttons", async ({
  page,
  request,
}) => {
  const token = await adminAuth(request);
  const headers = { authorization: `Bearer ${token}` };
  const catalog = await request.get(`${commerceUrl}/achilles/store/catalog`);
  const payload = (await catalog.json()) as {
    products: Array<{
      title: string;
      variants: Array<{ id: string }>;
    }>;
  };
  const product =
    payload.products.find((item) => /Lanterna/i.test(item.title)) ??
    payload.products[0];
  const variantId = product?.variants[0]?.id;
  if (!variantId) throw new Error("Variante pública E2E ausente");
  const cart = (await (
    await request.post(`${commerceUrl}/achilles/store/carts`, { data: {} })
  ).json()) as { cart: { id: string } };
  expect(
    (
      await request.post(
        `${commerceUrl}/achilles/store/carts/${cart.cart.id}/items`,
        { data: { variantId, quantity: 1 } },
      )
    ).status(),
  ).toBe(200);
  const checkoutResponse = await request.post(
    `${commerceUrl}/achilles/store/checkout`,
    { data: { cartId: cart.cart.id } },
  );
  expect(checkoutResponse.status()).toBe(201);
  const checkoutId = (
    (await checkoutResponse.json()) as { checkout: { id: string } }
  ).checkout.id;
  await request.patch(
    `${commerceUrl}/achilles/store/checkout/${checkoutId}/customer`,
    {
      data: {
        name: "Cliente Operacional",
        email: "ops-e2e@example.invalid",
        phone: "(11) 99999-0000",
      },
    },
  );
  await request.patch(
    `${commerceUrl}/achilles/store/checkout/${checkoutId}/address`,
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
    `${commerceUrl}/achilles/store/checkout/${checkoutId}/shipping/quote`,
  );
  expect(quoteResponse.status()).toBe(200);
  const quoteBody = (await quoteResponse.json()) as {
    checkout: {
      shippingGroups: Array<{
        id: string;
        methods: Array<{ id: string; name: string }>;
      }>;
    };
  };
  expect(quoteBody.checkout.shippingGroups.length).toBeGreaterThan(0);
  for (const group of quoteBody.checkout.shippingGroups) {
    const method =
      group.methods.find((candidate) => /Expressa/.test(candidate.name)) ??
      group.methods[0];
    if (!method) throw new Error("Frete E2E ausente");
    expect(
      (
        await request.post(
          `${commerceUrl}/achilles/store/checkout/${checkoutId}/shipping/select`,
          { data: { groupId: group.id, quoteId: method.id } },
        )
      ).status(),
    ).toBe(200);
  }
  expect(
    (
      await request.get(
        `${commerceUrl}/achilles/store/checkout/${checkoutId}/review`,
      )
    ).status(),
  ).toBe(200);
  const ready = await request.post(
    `${commerceUrl}/achilles/store/checkout/${checkoutId}/ready`,
  );
  expect(ready.status(), await ready.text()).toBe(200);
  const paymentResponse = await request.post(
    `${commerceUrl}/achilles/store/payment-intents`,
    {
      data: {
        checkoutId,
        method: "PIX",
        attemptId: crypto.randomUUID(),
        cpf: "529.982.247-25",
      },
    },
  );
  expect(paymentResponse.status()).toBe(201);
  const payment = (await paymentResponse.json()) as {
    paymentIntent: { id: string };
  };
  const eventId = `evt_ops_${crypto.randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const manifest = `id:${payment.paymentIntent.id.toLowerCase()};request-id:${eventId};ts:${timestamp};`;
  const signature = createHmac("sha256", "playwright_test_webhook_secret_only")
    .update(manifest)
    .digest("hex");
  expect(
    (
      await request.post(`${commerceUrl}/webhooks/test-payment`, {
        headers: { "x-signature": `ts=${timestamp},v1=${signature}` },
        data: {
          paymentIntentId: payment.paymentIntent.id,
          status: "PAID",
          eventId,
        },
      })
    ).status(),
  ).toBe(200);

  const orders = await request.get(`${commerceUrl}/admin/achilles/orders`, {
    headers,
  });
  expect(orders.status()).toBe(200);
  const list = (await orders.json()) as {
    orders: Array<{ id: string; reference: string }>;
  };
  const order = list.orders[0];
  if (!order) throw new Error("Pedido operacional ausente");
  expect(
    (
      await request.post(
        `${commerceUrl}/admin/achilles/orders/${order.id}/approve`,
        { headers, data: { confirmed: true } },
      )
    ).status(),
  ).toBe(200);
  const tracking = await request.post(
    `${commerceUrl}/admin/achilles/orders/${order.id}/tracking`,
    {
      headers,
      data: {
        carrier: "Correios",
        tracking_number: `BR${Date.now()}BR`,
        tracking_url: "https://example.invalid/tracking/ops",
      },
    },
  );
  expect(tracking.status(), await tracking.text()).toBe(200);

  await page.setExtraHTTPHeaders(headers);
  await page.goto(`${commerceUrl}/app/achilles-orders`);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByText("CRIAR PEDIDO TEST/SANDBOX")).toHaveCount(0);
  await expect(page.getByText("MARCAR TEST SHIPPED")).toHaveCount(0);
  await page.screenshot({
    path: `${evidenceDirectory}/admin-orders-operational.png`,
    fullPage: true,
  });
  await page.getByText(order.reference).click();
  await expect(
    page.getByRole("heading", { name: "Registrar rastreio" }),
  ).toBeVisible();
  await expect(page.getByText("Pagamento: Não informado · Enviado")).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/admin-tracking.png`,
    fullPage: true,
  });
});
