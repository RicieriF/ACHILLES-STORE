import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoPaymentProvider } from "./mercado-pago-provider";
import { FakePaymentProvider } from "./test-provider";
import { resolvePaymentProvider } from "./provider";

const base = {
  idempotencyKey: "logical-attempt-1",
  externalReference: "checkout_1:pay_1",
  amount: "199.90",
  currency: "BRL" as const,
  payer: { email: "buyer@example.com" },
};

describe("payment providers", () => {
  const originalEnvironment = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnvironment };
  });

  it("bloqueia provider fake em produção", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_ENV;
    process.env.PAYMENT_TEST_PROVIDER_ENABLED = "true";
    expect(() => resolvePaymentProvider()).toThrow(/FORBIDDEN/);
  });

  it("simula Pix pendente sem marcar como pago", async () => {
    const result = await new FakePaymentProvider().createPaymentIntent({
      ...base,
      method: "PIX",
      payer: { ...base.payer, taxpayerType: "CPF", taxpayerId: "52998224725" },
    });
    expect(result.status).toBe("PENDING");
    expect(result.pix?.testOnly).toBe(true);
    expect(result.expiresAt).toBeTruthy();
    await expect(providerStatus("paid")).resolves.toMatchObject({
      status: "PAID",
    });
    await expect(providerStatus("failed")).resolves.toMatchObject({
      status: "FAILED",
    });
    await expect(providerStatus("expired")).resolves.toMatchObject({
      status: "EXPIRED",
    });
  });

  it("simula cartão aprovado, recusado e parcelamento sem dados brutos", async () => {
    const provider = new FakePaymentProvider();
    const approved = await provider.createPaymentIntent({
      ...base,
      method: "CARD",
      card: {
        token: "tok_test_approved",
        paymentMethodId: "master",
        installments: 2,
      },
    });
    const failed = await provider.createPaymentIntent({
      ...base,
      idempotencyKey: "attempt-2",
      method: "CARD",
      card: {
        token: "tok_test_declined",
        paymentMethodId: "master",
        installments: 1,
      },
    });
    expect(approved.status).toBe("PAID");
    expect(approved.installments?.[0]?.count).toBe(2);
    expect(failed.status).toBe("FAILED");
    expect(JSON.stringify({ approved, failed })).not.toMatch(
      /cardNumber|cvv|securityCode/i,
    );
  });

  it("falha fechado fora de TEST ou sem token", () => {
    expect(
      () =>
        new MercadoPagoPaymentProvider({
          environment: "PRODUCTION",
          accessToken: "not-real",
          publicKey: "not-real",
          pix: true,
          card: true,
          boleto: false,
        }),
    ).toThrow("TEST_ONLY");
    expect(
      () =>
        new MercadoPagoPaymentProvider({
          environment: "TEST",
          accessToken: "",
          publicKey: "",
          pix: true,
          card: true,
          boleto: false,
        }),
    ).toThrow("TOKEN_MISSING");
  });

  it("usa total autoritativo informado pelo serviço e X-Idempotency-Key", async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      expect(
        (init.headers as Record<string, string>)["x-idempotency-key"],
      ).toBe(base.idempotencyKey);
      const payload = JSON.parse(
        typeof init.body === "string" ? init.body : "{}",
      ) as Record<string, unknown>;
      expect(payload.total_amount).toBe("199.90");
      expect(JSON.stringify(payload)).not.toMatch(
        /card_number|cvv|security_code/i,
      );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "mp_order_test",
            status: "processed",
            status_detail: "accredited",
            transactions: {
              payments: [{ status: "processed", status_detail: "accredited" }],
            },
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MercadoPagoPaymentProvider({
      environment: "TEST",
      accessToken: "test-only-token",
      publicKey: "test-only-public",
      pix: false,
      card: true,
      boleto: false,
    });
    const result = await provider.createPaymentIntent({
      ...base,
      method: "CARD",
      card: {
        token: "single-use-token",
        paymentMethodId: "master",
        installments: 1,
      },
    });
    expect(result.status).toBe("PAID");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

function providerStatus(status: string) {
  return new FakePaymentProvider().getPaymentStatus(`test_order_${status}`);
}
