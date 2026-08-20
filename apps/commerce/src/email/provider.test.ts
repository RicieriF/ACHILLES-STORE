import { afterEach, describe, expect, it } from "vitest";
import { renderAchillesEmail, TestEmailProvider } from "./provider";
const appEnv = process.env.APP_ENV;
afterEach(() => {
  process.env.APP_ENV = appEnv;
});
describe("transactional email", () => {
  it("renders branded sanitized pt-BR content without supplier data", () => {
    const rendered = renderAchillesEmail({
      event: "ORDER_SHIPPED",
      to: "customer@example.invalid",
      customerName: "<Ricieri>",
      orderReference: "ACH-2026-000001",
    });
    expect(rendered).toContain("ACHILLES STORE");
    expect(rendered).not.toContain("<Ricieri>");
    expect(rendered).not.toMatch(/Alibaba|CJ|margem|fornecedor/i);
  });
  it("blocks the offline provider in production", async () => {
    process.env.APP_ENV = "production";
    await expect(
      new TestEmailProvider().send({
        event: "ORDER_RECEIVED",
        to: "x@example.invalid",
        customerName: "X",
        orderReference: "ACH-1",
      }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});
