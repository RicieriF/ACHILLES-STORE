import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Next image allowlist", () => {
  it("allows only the CJ hosts already used by the storefront", () => {
    expect(nextConfig.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "oss-cf.cjdropshipping.com" },
      { protocol: "https", hostname: "cf.cjdropshipping.com" },
    ]);
    expect(JSON.stringify(nextConfig.images)).not.toContain('"hostname":"**"');
  });
});
