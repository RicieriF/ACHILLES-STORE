import { afterEach, describe, expect, it } from "vitest";
import {
  isFixtureSourceUrl,
  testFixtureMetadata,
  testFixtureProviderMetadata,
} from "./test-fixture";

const original = process.env.APP_ENV;

afterEach(() => {
  if (original === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = original;
});

describe("test fixture markers", () => {
  it("recognizes technical fixture hosts", () => {
    expect(isFixtureSourceUrl("https://example.invalid/item/1")).toBe(true);
    expect(
      isFixtureSourceUrl("https://fixture.invalid/product/CJ-FIXTURE-001"),
    ).toBe(true);
    expect(isFixtureSourceUrl("https://www.aliexpress.com/item/1.html")).toBe(
      false,
    );
  });

  it("marks metadata in the test runtime", () => {
    process.env.APP_ENV = "test";
    expect(testFixtureMetadata({ origin: "cj" })).toMatchObject({
      achilles_test_fixture: true,
      origin: "cj",
    });
    expect(testFixtureProviderMetadata()).toEqual({
      achilles_test_fixture: true,
    });
  });

  it("does not mark ordinary development records", () => {
    process.env.APP_ENV = "development";
    expect(testFixtureMetadata({ featured: true })).toEqual({ featured: true });
  });
});
