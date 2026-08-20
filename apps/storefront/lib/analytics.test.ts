import { describe, expect, it } from "vitest";
import { track } from "./analytics";
describe("analytics preparation", () => {
  it("stays inert without an id and rejects PII properties when configured", () => {
    expect(() => track("page_view", { path: "/" })).not.toThrow();
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = "GA4";
    process.env.NEXT_PUBLIC_ANALYTICS_ID = "test-only";
    expect(() => track("purchase", { email: "hidden" })).toThrow(/PII/);
  });
});
