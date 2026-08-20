import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "./webhook-signature";

describe("Mercado Pago webhook signature", () => {
  it("aceita manifesto HMAC atual e rejeita adulteração/expiração", () => {
    const ts = 2_000_000_000;
    const secret = "unit-test-only-secret";
    const manifest = `id:order_1;request-id:req_1;ts:${String(ts)};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    const base = {
      signature: `ts=${String(ts)},v1=${v1}`,
      requestId: "req_1",
      dataId: "ORDER_1",
      secret,
      now: ts * 1000,
    };
    expect(verifyMercadoPagoSignature(base)).toBe(true);
    expect(verifyMercadoPagoSignature({ ...base, dataId: "order_2" })).toBe(
      false,
    );
    expect(
      verifyMercadoPagoSignature({ ...base, now: ts * 1000 + 301_000 }),
    ).toBe(false);
  });
});
