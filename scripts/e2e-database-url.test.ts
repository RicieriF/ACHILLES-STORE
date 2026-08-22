import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertE2eDatabaseUrl,
  resolveE2eDatabaseUrl,
  resolveOperatorDatabaseUrl,
} from "./e2e-database-url.ts";

describe("e2e database URL isolation", () => {
  it("derives the e2e database from the CI operator URL", () => {
    const env = {
      DATABASE_URL: "postgres://achilles:ci_only@localhost:5432/achilles_store",
    };
    assert.equal(
      resolveOperatorDatabaseUrl(env),
      "postgres://achilles:ci_only@localhost:5432/achilles_store",
    );
    assert.equal(
      resolveE2eDatabaseUrl(env),
      "postgres://achilles:ci_only@localhost:5432/achilles_store_e2e",
    );
  });

  it("prefers an explicit E2E_DATABASE_URL", () => {
    assert.match(
      resolveE2eDatabaseUrl({
        DATABASE_URL:
          "postgres://achilles:ci_only@localhost:5432/achilles_store",
        E2E_DATABASE_URL:
          "postgres://achilles:ci_only@localhost:5432/achilles_store_e2e",
      }),
      /\/achilles_store_e2e$/,
    );
  });

  it("aborts when the resolved database is not isolated", () => {
    assert.throws(
      () =>
        assertE2eDatabaseUrl(
          "postgres://achilles:ci_only@localhost:5432/achilles_store",
        ),
      /achilles_store_e2e/,
    );
  });
});
