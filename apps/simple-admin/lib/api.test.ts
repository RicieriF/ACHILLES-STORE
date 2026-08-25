import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, session } from "./api";

const storage = new Map<string, string>();

describe("Simple Admin api", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      location: { replace: vi.fn() },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards the session token and returns JSON", async () => {
    session.set("test-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api<{ ok: boolean }>("admin/example")).resolves.toEqual({
      ok: true,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-token",
    );
  });

  it("aborts a request and returns a human timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const request = api("admin/slow", { timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    await expect(request).rejects.toMatchObject({
      code: "SIMPLE_ADMIN_TIMEOUT",
      status: 504,
      message: "Esta operação demorou mais que o esperado. Tente novamente.",
    });
    vi.useRealTimers();
  });

  it("preserves a useful backend conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "CJ_PRODUCT_ALREADY_IMPORTED",
            message: "Este produto já está na sua vitrine.",
            productId: "prod_123",
          }),
          { status: 409 },
        ),
      ),
    );

    await expect(api("admin/import", { method: "POST" })).rejects.toMatchObject(
      {
        code: "CJ_PRODUCT_ALREADY_IMPORTED",
        status: 409,
        details: { productId: "prod_123" },
      },
    );
  });

  it("translates invalid login credentials without exposing backend text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
        }),
      ),
    );

    await expect(
      api("auth/user/emailpass", { method: "POST" }),
    ).rejects.toMatchObject({
      status: 401,
      message: "E-mail ou senha incorretos.",
    });
  });
});
