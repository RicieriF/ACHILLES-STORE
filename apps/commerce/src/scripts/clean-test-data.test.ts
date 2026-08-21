import { afterEach, describe, expect, it } from "vitest";
import { assertCleanupEnvironment } from "./clean-test-data";

const originalAuthorization = process.env.ALLOW_STAGING_TEST_DATA_CLEANUP;

afterEach(() => {
  if (originalAuthorization === undefined)
    delete process.env.ALLOW_STAGING_TEST_DATA_CLEANUP;
  else process.env.ALLOW_STAGING_TEST_DATA_CLEANUP = originalAuthorization;
});

describe("test fixture cleanup guard", () => {
  it.each(["development", "test"])("allows %s", (environment) => {
    expect(() => {
      assertCleanupEnvironment(environment);
    }).not.toThrow();
  });

  it("requires explicit staging authorization", () => {
    delete process.env.ALLOW_STAGING_TEST_DATA_CLEANUP;
    expect(() => {
      assertCleanupEnvironment("staging");
    }).toThrow("STAGING_TEST_DATA_CLEANUP_REQUIRES_EXPLICIT_AUTHORIZATION");
    process.env.ALLOW_STAGING_TEST_DATA_CLEANUP = "true";
    expect(() => {
      assertCleanupEnvironment("staging");
    }).not.toThrow();
  });

  it.each(["production", "preview", ""])(
    "rejects unsafe environment %j",
    (environment) => {
      expect(() => {
        assertCleanupEnvironment(environment);
      }).toThrow();
    },
  );
});
