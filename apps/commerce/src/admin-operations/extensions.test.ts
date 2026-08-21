import { describe, expect, it } from "vitest";
import { extensionCards, isS3Configured } from "./extensions";

describe("operations extension status", () => {
  it("keeps analytics disabled by default and never exposes secret values", () => {
    const cards = extensionCards({ POSTHOG_KEY: "secret-value" });
    expect(cards.find((card) => card.id === "posthog")?.status).toBe(
      "DISABLED",
    );
    expect(JSON.stringify(cards)).not.toContain("secret-value");
  });

  it("requires the complete S3-compatible configuration", () => {
    expect(isS3Configured({ S3_BUCKET: "partial" })).toBe(false);
    expect(
      isS3Configured({
        S3_FILE_URL: "https://files.example.test",
        S3_ACCESS_KEY_ID: "fake",
        S3_SECRET_ACCESS_KEY: "fake",
        S3_REGION: "auto",
        S3_BUCKET: "achilles",
        S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      }),
    ).toBe(true);
  });
});
