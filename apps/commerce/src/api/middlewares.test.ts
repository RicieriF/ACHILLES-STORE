import { describe, expect, it, vi } from "vitest";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { blockImportedProductPublication } from "./middlewares";

function context(
  body: Record<string, unknown>,
  metadata: Record<string, unknown> | null,
) {
  const next = vi.fn() as MedusaNextFunction;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const request = {
    body,
    params: { id: "prod_1" },
    scope: {
      resolve: () => ({
        retrieveProduct: vi.fn().mockResolvedValue({ metadata }),
      }),
    },
  } as unknown as MedusaRequest;
  return {
    request,
    response: { status } as unknown as MedusaResponse,
    next,
    status,
  };
}
describe("imported product publication guard", () => {
  it("blocks publication of imported products", async () => {
    const value = context(
      { status: "published" },
      { achilles_import_draft_id: "impdraft_1" },
    );
    await blockImportedProductPublication(
      value.request,
      value.response,
      value.next,
    );
    expect(value.status).toHaveBeenCalledWith(409);
    expect(value.next).not.toHaveBeenCalled();
  });
  it("does not affect ordinary product updates", async () => {
    const value = context({ title: "Novo título" }, null);
    await blockImportedProductPublication(
      value.request,
      value.response,
      value.next,
    );
    expect(value.next).toHaveBeenCalledOnce();
  });
});
