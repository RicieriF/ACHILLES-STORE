import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function responseCapture() {
  return {
    payload: undefined as unknown,
    json(payload: unknown) {
      this.payload = payload;
    },
  };
}

describe("operational categories route", () => {
  it("returns only the small UI contract with hierarchy", async () => {
    const graph = vi.fn().mockResolvedValue({
      data: [
        {
          id: "pcat_child",
          name: "Lanternas",
          handle: "lanternas",
          parent_category: { id: "pcat_parent", name: "Camping" },
          metadata: { technical: "must not leak" },
        },
      ],
    });
    const response = responseCapture();
    await GET(
      {
        scope: { resolve: () => ({ graph }) },
      } as never,
      response as never,
    );
    expect(graph).toHaveBeenCalledWith({
      entity: "product_category",
      fields: [
        "id",
        "name",
        "handle",
        "parent_category.id",
        "parent_category.name",
      ],
      filters: { is_active: true },
    });
    expect(response.payload).toEqual({
      categories: [
        {
          id: "pcat_child",
          name: "Lanternas",
          handle: "lanternas",
          parent: { id: "pcat_parent", name: "Camping" },
        },
      ],
    });
  });

  it("returns a stable empty list", async () => {
    const response = responseCapture();
    await GET(
      {
        scope: {
          resolve: () => ({
            graph: vi.fn().mockResolvedValue({ data: [] }),
          }),
        },
      } as never,
      response as never,
    );
    expect(response.payload).toEqual({ categories: [] });
  });
});
