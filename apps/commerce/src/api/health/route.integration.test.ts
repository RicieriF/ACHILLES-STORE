import { describe, expect, it, vi } from "vitest";
import { GET } from "./route.js";
describe("commerce health endpoint", () => {
  it("returns a stable health payload", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    GET({} as never, { status } as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ service: "commerce", status: "ok" });
  });
});
