import type { ShippingProviderHealth } from "@achilles/domain";

type CacheEntry<T> = { value: T; expiresAt: number };

export class ShortTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  constructor(
    private readonly maximumTtlMs = 60_000,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, {
      value,
      expiresAt: this.clock() + Math.min(ttlMs, this.maximumTtlMs),
    });
  }
}

export class ShippingRateLimiter {
  private readonly counters = new Map<
    string,
    { count: number; resetsAt: number }
  >();
  constructor(
    private readonly maximum = 12,
    private readonly windowMs = 60_000,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  consume(key: string): boolean {
    const now = this.clock();
    const current = this.counters.get(key);
    if (!current || current.resetsAt <= now) {
      this.counters.set(key, { count: 1, resetsAt: now + this.windowMs });
      return true;
    }
    if (current.count >= this.maximum) return false;
    current.count += 1;
    return true;
  }
}

export class ProviderHealthTracker {
  private readonly failures = new Map<string, number>();

  success(provider: string): void {
    this.failures.delete(provider);
  }

  failure(provider: string): void {
    this.failures.set(provider, (this.failures.get(provider) ?? 0) + 1);
  }

  health(provider: string, enabled: boolean): ShippingProviderHealth {
    if (!enabled) return "DISABLED";
    const failures = this.failures.get(provider) ?? 0;
    if (failures >= 3) return "UNAVAILABLE";
    if (failures > 0) return "DEGRADED";
    return "HEALTHY";
  }
}

export async function executeWithProviderResilience<T>(
  operation: () => Promise<T>,
  options: {
    timeoutMs: number;
    retries: number;
    wait?: ((milliseconds: number) => Promise<void>) | undefined;
  },
): Promise<T> {
  const wait =
    options.wait ??
    ((milliseconds: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      }));
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new ProviderTimeoutError(options.timeoutMs));
          }, options.timeoutMs);
        }),
      ]);
    } catch (error) {
      lastError = error;
      if (attempt >= options.retries || !isRetryable(error)) throw error;
      await wait(Math.min(100 * 2 ** attempt, 1_000));
    }
  }
  throw lastError;
}

export class ProviderTimeoutError extends Error {
  readonly retryable = true;
  constructor(timeoutMs: number) {
    super(`Provider excedeu timeout de ${String(timeoutMs)}ms`);
    this.name = "ProviderTimeoutError";
  }
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof ProviderTimeoutError ||
    (typeof error === "object" &&
      error !== null &&
      "retryable" in error &&
      error.retryable === true)
  );
}
