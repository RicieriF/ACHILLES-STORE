import { createHash } from "node:crypto";
import type {
  FulfillmentTrackingStatus,
  SupplierOrderProvider,
  SupplierOrderProviderCapabilities,
  SupplierOrderProviderHealth,
  SupplierOrderRequest,
  SupplierOrderResult,
} from "@achilles/domain";

const disabledCapabilities: SupplierOrderProviderCapabilities = {
  quote: false,
  stock: false,
  createOrder: false,
  payOrder: false,
  cancelOrder: false,
  tracking: false,
};

export class RealSupplierExecutionDisabledError extends Error {
  constructor(readonly provider: "ALIBABA" | "CJ") {
    super(`Execução real desativada para ${provider}.`);
    this.name = "RealSupplierExecutionDisabledError";
  }
}

abstract class DisabledRealSupplierOrderProvider implements SupplierOrderProvider {
  abstract readonly provider: "ALIBABA" | "CJ";
  getHealth(): SupplierOrderProviderHealth {
    return "DISABLED";
  }
  getCapabilities(): SupplierOrderProviderCapabilities {
    return disabledCapabilities;
  }
  createOrder(_input: SupplierOrderRequest): Promise<SupplierOrderResult> {
    return Promise.reject(
      new RealSupplierExecutionDisabledError(this.provider),
    );
  }
  payOrder(_providerOrderId: string): Promise<never> {
    return Promise.reject(
      new RealSupplierExecutionDisabledError(this.provider),
    );
  }
  cancelOrder(_providerOrderId: string): Promise<SupplierOrderResult> {
    return Promise.reject(
      new RealSupplierExecutionDisabledError(this.provider),
    );
  }
  getTracking(_providerOrderId: string): Promise<null> {
    return Promise.resolve(null);
  }
}

export class AlibabaSupplierOrderProvider extends DisabledRealSupplierOrderProvider {
  readonly provider = "ALIBABA" as const;
}

export class CJSupplierOrderProvider extends DisabledRealSupplierOrderProvider {
  readonly provider = "CJ" as const;
}

type TestOrder = SupplierOrderResult & {
  trackingStatus: FulfillmentTrackingStatus;
};

export class TestSupplierOrderProvider implements SupplierOrderProvider {
  readonly provider = "TEST" as const;
  private static readonly orders = new Map<string, TestOrder>();

  getHealth(): SupplierOrderProviderHealth {
    return "HEALTHY";
  }
  getCapabilities(): SupplierOrderProviderCapabilities {
    return {
      quote: true,
      stock: true,
      createOrder: true,
      payOrder: false,
      cancelOrder: true,
      tracking: true,
    };
  }
  createOrder(input: SupplierOrderRequest): Promise<SupplierOrderResult> {
    const prior = TestSupplierOrderProvider.orders.get(input.idempotencyKey);
    if (prior) return Promise.resolve(prior);
    const scenario = input.scenario ?? "accepted";
    if (scenario === "failure")
      return Promise.reject(new Error("TEST_PROVIDER_FAILURE"));
    const rejected = [
      "rejected",
      "out_of_stock",
      "price_changed",
      "shipping_changed",
    ].includes(scenario);
    const providerOrderId = `test_${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 20)}`;
    const result: TestOrder = {
      providerOrderId,
      status: rejected
        ? "REJECTED"
        : scenario === "pending"
          ? "SUBMITTED"
          : "CONFIRMED",
      sandbox: true,
      reason: rejected ? scenario.toUpperCase() : null,
      trackingStatus:
        scenario === "tracking_available" ? "IN_TRANSIT" : "LABEL_CREATED",
    };
    TestSupplierOrderProvider.orders.set(input.idempotencyKey, result);
    return Promise.resolve(result);
  }
  payOrder(_providerOrderId: string): Promise<never> {
    return Promise.reject(new Error("TEST_PAYMENT_NOT_IMPLEMENTED"));
  }
  cancelOrder(providerOrderId: string): Promise<SupplierOrderResult> {
    return Promise.resolve({
      providerOrderId,
      status: "REJECTED",
      sandbox: true,
      reason: "CANCELLED_IN_SANDBOX",
    });
  }
  getTracking(providerOrderId: string) {
    const order = [...TestSupplierOrderProvider.orders.values()].find(
      (candidate) => candidate.providerOrderId === providerOrderId,
    );
    return Promise.resolve(
      order
        ? {
            carrier: "ACHILLES TEST LOGISTICS",
            trackingNumber: `TEST-${providerOrderId.slice(-10).toUpperCase()}`,
            status: order.trackingStatus,
          }
        : null,
    );
  }
}

export function supplierOrderProvider(provider: string): SupplierOrderProvider {
  if (provider === "TEST") return new TestSupplierOrderProvider();
  if (provider === "ALIBABA") return new AlibabaSupplierOrderProvider();
  if (provider === "CJ") return new CJSupplierOrderProvider();
  throw new Error("SUPPLIER_ORDER_PROVIDER_UNSUPPORTED");
}
