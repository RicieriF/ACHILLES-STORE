import { describe, expect, it } from "vitest";
import { parseFeatureFlags } from "@achilles/config";
import {
  AlibabaCapabilityDisabledError,
  AlibabaConnector,
  AlibabaUrlError,
  decimal,
  fetchWithTimeout,
  normalizeProduct,
  parseAlibabaUrl,
  retrySafe,
  validateRedirect,
} from "./index.js";

describe("AlibabaConnector safety boundary", () => {
  it("defaults every capability to off", () => {
    expect(new AlibabaConnector(parseFeatureFlags({})).capabilities).toEqual({
      productImport: false,
      freightQuote: false,
      orderCreate: false,
      orderPay: false,
      tracking: false,
      privateLabel: false,
    });
  });
  it("never fakes a successful external read", async () => {
    const connector = new AlibabaConnector(parseFeatureFlags({}));
    await expect(
      connector.getProduct({
        provider: "ALIBABA",
        supplierProductId: "example",
        sourceUrl: "https://www.alibaba.com/x/example",
      }),
    ).rejects.toBeInstanceOf(AlibabaCapabilityDisabledError);
  });
  it("accepts canonical and short Alibaba HTTPS URLs without external collection when off", async () => {
    const connector = new AlibabaConnector(parseFeatureFlags({}));
    await expect(
      connector.resolveProductUrl(
        "https://www.alibaba.com/product-detail/Test_1600123456789.html#tab",
      ),
    ).resolves.toMatchObject({
      supplierProductId: "1600123456789",
      sourceUrl:
        "https://www.alibaba.com/product-detail/Test_1600123456789.html",
    });
    await expect(
      connector.resolveProductUrl("https://www.alibaba.com/x/abc123"),
    ).resolves.toMatchObject({ provider: "ALIBABA" });
  });
  it.each([
    "http://www.alibaba.com/product-detail/x_123456.html",
    "https://evil-alibaba.example/product-detail/x_123456.html",
    "https://127.0.0.1/product-detail/x_123456.html",
    "https://localhost/product-detail/x_123456.html",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => parseAlibabaUrl(url)).toThrow(AlibabaUrlError);
  });
  it("blocks redirects leaving the allowlist", () => {
    expect(() =>
      validateRedirect(
        new URL("https://www.alibaba.com/x/a"),
        "https://example.com/item",
      ),
    ).toThrow(AlibabaUrlError);
  });
  it("normalizes decimals, MOQ and preserves raw evidence", () => {
    const source = {
      reference: {
        provider: "ALIBABA",
        supplierProductId: "1600123456789",
        sourceUrl:
          "https://www.alibaba.com/product-detail/Test_1600123456789.html",
      },
      title: "  Lanterna   outdoor  ",
      description: " Teste ",
      currency: " usd ",
      priceMin: "US$ 12,50",
      moq: 10.9,
      category: " Camping ",
      media: [],
      specifications: { Peso: " 250 g " },
      variants: [],
      metadata: {},
      obtainedAt: "2026-08-20T00:00:00.000Z",
      method: "MANUAL" as const,
    };
    const normalized = normalizeProduct(source);
    expect(normalized).toMatchObject({
      title: "Lanterna outdoor",
      currency: "USD",
      priceMin: "12.50",
      moq: 10,
      compliance: "CLEAR",
    });
    expect(normalized.source.title).toBe("  Lanterna   outdoor  ");
    expect(decimal("1,234.56")).toBe("1234.56");
  });
  it.each([
    ["Faca knife para camping", "REVIEW_REQUIRED"],
    ["Firearm gun part", "BLOCKED"],
  ] as const)("triages %s as %s", (title, compliance) => {
    expect(
      normalizeProduct({
        reference: {
          provider: "ALIBABA",
          supplierProductId: "x",
          sourceUrl: "https://www.alibaba.com/x/x",
        },
        title,
        media: [],
        specifications: {},
        variants: [],
        metadata: {},
        obtainedAt: new Date(0).toISOString(),
        method: "MANUAL",
      }).compliance,
    ).toBe(compliance);
  });
  it("retries only transient work and stops after a small bound", async () => {
    let calls = 0;
    await expect(
      retrySafe(() => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error("temporary"));
        return Promise.resolve("ok");
      }),
    ).resolves.toBe("ok");
    expect(calls).toBe(2);
    calls = 0;
    await expect(
      retrySafe(() => {
        calls += 1;
        return Promise.reject(
          Object.assign(new Error("forbidden"), { retryable: false }),
        );
      }),
    ).rejects.toThrow("forbidden");
    expect(calls).toBe(1);
  });
  it("aborts an external request after the explicit timeout", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = ((_url: URL, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        }),
      )) as typeof fetch;
    try {
      await expect(
        fetchWithTimeout(new URL("https://www.alibaba.com/"), {}, 5),
      ).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      globalThis.fetch = original;
    }
  });
});
