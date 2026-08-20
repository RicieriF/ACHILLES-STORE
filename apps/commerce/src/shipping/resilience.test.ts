import { describe, expect, it, vi } from "vitest";
import {
  executeWithProviderResilience,
  ProviderHealthTracker,
  ShortTtlCache,
  ShippingRateLimiter,
} from "./resilience";

describe("shipping provider protection", () => {
  it("usa cache curto e expira", () => {
    let now = 0;
    const cache = new ShortTtlCache<string>(1_000, () => now);
    cache.set("key", "quote", 500);
    expect(cache.get("key")).toBe("quote");
    now = 501;
    expect(cache.get("key")).toBeUndefined();
  });

  it("limita abuso por chave e reinicia a janela", () => {
    let now = 0;
    const limiter = new ShippingRateLimiter(2, 1_000, () => now);
    expect(limiter.consume("ip:cep:product")).toBe(true);
    expect(limiter.consume("ip:cep:product")).toBe(true);
    expect(limiter.consume("ip:cep:product")).toBe(false);
    now = 1_001;
    expect(limiter.consume("ip:cep:product")).toBe(true);
  });

  it("faz retry somente para erro transitório", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("transitório"), { retryable: true }),
      )
      .mockResolvedValue("ok");
    await expect(
      executeWithProviderResilience(operation, {
        timeoutMs: 500,
        retries: 1,
        wait: () => Promise.resolve(),
      }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("não repete erro definitivo", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error("4xx"));
    await expect(
      executeWithProviderResilience(operation, {
        timeoutMs: 500,
        retries: 2,
        wait: () => Promise.resolve(),
      }),
    ).rejects.toThrow("4xx");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("aplica timeout limitado", async () => {
    vi.useFakeTimers();
    const result = executeWithProviderResilience(
      () => new Promise<string>(() => undefined),
      { timeoutMs: 50, retries: 0 },
    );
    const expectation = expect(result).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(51);
    await expectation;
    vi.useRealTimers();
  });

  it("degrada e indisponibiliza provider sem derrubar o processo", () => {
    const tracker = new ProviderHealthTracker();
    expect(tracker.health("A", true)).toBe("HEALTHY");
    tracker.failure("A");
    expect(tracker.health("A", true)).toBe("DEGRADED");
    tracker.failure("A");
    tracker.failure("A");
    expect(tracker.health("A", true)).toBe("UNAVAILABLE");
    expect(tracker.health("B", false)).toBe("DISABLED");
  });
});
