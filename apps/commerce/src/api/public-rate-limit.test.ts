import { describe, expect, it, vi } from "vitest";
import { publicRateLimit, resetPublicRateLimits } from "./public-rate-limit";
describe("public rate limit", () => {
  it("limits repeated sensitive requests", () => {
    resetPublicRateLimits();
    const next = vi.fn();
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const request = {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      path: "/payment",
    };
    for (let index = 0; index < 121; index += 1)
      publicRateLimit(request as never, response as never, next);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(120);
  });
});
