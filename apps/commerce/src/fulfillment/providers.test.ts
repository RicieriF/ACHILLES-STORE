import { describe, expect, it } from "vitest";
import type { SupplierOrderRequest } from "@achilles/domain";
import {
  AlibabaSupplierOrderProvider,
  CJSupplierOrderProvider,
  RealSupplierExecutionDisabledError,
  TestSupplierOrderProvider,
} from "./providers";

const request: SupplierOrderRequest = {
  idempotencyKey: "order:group:1",
  supplierOrderId: "supord_1",
  recipient: {
    name: "CLIENTE TESTE",
    address1: "Rua***",
    address2: null,
    city: "São Paulo",
    state: "SP",
    postalCode: "*****100",
    countryCode: "BR",
    phone: "TEST-NOT-SENT",
  },
  currency: "BRL",
  expectedTotal: "67.50",
  items: [{ supplierSku: "TEST-SKU", quantity: 1 }],
};

describe("SupplierOrderProvider isolation", () => {
  it.each([new AlibabaSupplierOrderProvider(), new CJSupplierOrderProvider()])(
    "mantém $provider create/pay fail-closed",
    async (provider) => {
      expect(provider.getHealth()).toBe("DISABLED");
      expect(provider.getCapabilities().createOrder).toBe(false);
      await expect(provider.createOrder(request)).rejects.toBeInstanceOf(
        RealSupplierExecutionDisabledError,
      );
      await expect(provider.payOrder("real-order")).rejects.toBeInstanceOf(
        RealSupplierExecutionDisabledError,
      );
    },
  );

  it("cria uma única ordem determinística no sandbox e disponibiliza tracking TEST", async () => {
    const provider = new TestSupplierOrderProvider();
    const first = await provider.createOrder({
      ...request,
      scenario: "tracking_available",
    });
    const second = await provider.createOrder({
      ...request,
      scenario: "tracking_available",
    });
    expect(second).toEqual(first);
    expect(first).toMatchObject({ status: "CONFIRMED", sandbox: true });
    await expect(
      provider.getTracking(first.providerOrderId),
    ).resolves.toMatchObject({
      carrier: "ACHILLES TEST LOGISTICS",
      status: "IN_TRANSIT",
    });
  });

  it.each([
    ["rejected", "REJECTED"],
    ["pending", "SUBMITTED"],
    ["out_of_stock", "REJECTED"],
    ["price_changed", "REJECTED"],
    ["shipping_changed", "REJECTED"],
  ] as const)("simula %s sem internet", async (scenario, status) => {
    const result = await new TestSupplierOrderProvider().createOrder({
      ...request,
      idempotencyKey: `scenario:${scenario}`,
      scenario,
    });
    expect(result.status).toBe(status);
    expect(result.sandbox).toBe(true);
  });
});
