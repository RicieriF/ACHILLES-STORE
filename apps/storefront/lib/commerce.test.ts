import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicCatalog, StorefrontDataError } from "./commerce";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public catalog failures", () => {
  it("returns an empty catalog when the API responds successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ products: [], categories: [] }), {
          status: 200,
        }),
      ),
    );

    await expect(getPublicCatalog()).resolves.toMatchObject({
      products: [],
    });
  });

  it("reports a catalog error only when the API request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("failure", { status: 500 })),
    );

    await expect(getPublicCatalog()).rejects.toBeInstanceOf(
      StorefrontDataError,
    );
  });
});
