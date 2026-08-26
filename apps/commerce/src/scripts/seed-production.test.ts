import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const createCategories = vi.fn();
const createShippingProfiles = vi.fn();

vi.mock("@medusajs/medusa/core-flows", () => ({
  createProductCategoriesWorkflow: () => ({ run: createCategories }),
  createShippingProfilesWorkflow: () => ({ run: createShippingProfiles }),
}));

import seedProductionStructure from "./seed-production";

describe("production structural seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCategories.mockResolvedValue({ result: [] });
    createShippingProfiles.mockResolvedValue({
      result: [{ id: "sp_default" }],
    });
  });

  it("creates the default shipping profile once without creating catalog fixtures", async () => {
    const listShippingProfiles = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "sp_default", type: "default" }]);
    const query = {
      graph: vi.fn().mockResolvedValue({
        data: [
          { handle: "lanternas" },
          { handle: "edc" },
          { handle: "cutelaria" },
          { handle: "camping-outdoor" },
        ],
      }),
    };
    const logger = { info: vi.fn() };
    const container = {
      resolve: vi.fn((key: string) => {
        if (key === ContainerRegistrationKeys.LOGGER) return logger;
        if (key === ContainerRegistrationKeys.QUERY) return query;
        if (key === Modules.FULFILLMENT) return { listShippingProfiles };
        throw new Error(`Unexpected dependency: ${key}`);
      }),
    };

    await seedProductionStructure({ container } as never);
    await seedProductionStructure({ container } as never);

    expect(createShippingProfiles).toHaveBeenCalledTimes(1);
    expect(createShippingProfiles).toHaveBeenCalledWith({
      input: {
        data: [{ name: "Perfil de entrega padrão", type: "default" }],
      },
    });
    expect(createCategories).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("no products, orders, payments, or suppliers"),
    );
  });
});
