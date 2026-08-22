export const E2E_DATABASE_NAME = "achilles_store_e2e";
export const OPERATOR_DATABASE_NAME = "achilles_store";

const localOperatorUrl =
  "postgres://achilles:local_development_only@localhost:5432/achilles_store";

export function isCi(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CI === "true";
}

export function databaseNameFromUrl(url: string): string {
  const pathname = new URL(url).pathname.replaceAll(/^\/|\/$/g, "");
  return pathname.split("/")[0] ?? "";
}

export function rewriteDatabaseUrl(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString().replace(/\/$/, "");
}

export function resolveOperatorDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.OPERATOR_DATABASE_URL?.trim() ||
    env.DATABASE_URL?.trim() ||
    localOperatorUrl
  );
}

export function resolveE2eDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.E2E_DATABASE_URL?.trim()) return env.E2E_DATABASE_URL.trim();
  return rewriteDatabaseUrl(resolveOperatorDatabaseUrl(env), E2E_DATABASE_NAME);
}

export function assertE2eDatabaseUrl(url: string): void {
  const name = databaseNameFromUrl(url);
  if (name !== E2E_DATABASE_NAME) {
    throw new Error(
      `E2E aborted: database must be ${E2E_DATABASE_NAME}, got ${name || "(empty)"}`,
    );
  }
}
