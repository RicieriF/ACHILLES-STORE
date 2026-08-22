const { spawnSync } =
  require("node:child_process") as typeof import("node:child_process");
const { readdirSync } = require("node:fs") as typeof import("node:fs");
const { createRequire } =
  require("node:module") as typeof import("node:module");
const { join } = require("node:path") as typeof import("node:path");

const E2E_DATABASE_NAME = "achilles_store_e2e";
const localOperatorUrl =
  "postgres://achilles:local_development_only@localhost:5432/achilles_store";

function isCi(): boolean {
  return process.env.CI === "true";
}

function databaseNameFromUrl(url: string): string {
  const pathname = new URL(url).pathname.replaceAll(/^\/|\/$/g, "");
  return pathname.split("/")[0] ?? "";
}

function rewriteDatabaseUrl(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString().replace(/\/$/, "");
}

function sourceUrl(): string {
  return (
    process.env.OPERATOR_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    localOperatorUrl
  );
}

function assertE2eTarget(): void {
  const configured =
    process.env.E2E_DATABASE_URL?.trim() ||
    rewriteDatabaseUrl(sourceUrl(), E2E_DATABASE_NAME);
  const name = databaseNameFromUrl(configured);
  if (name !== E2E_DATABASE_NAME) {
    throw new Error(
      `E2E aborted: database must be ${E2E_DATABASE_NAME}, got ${name || "(empty)"}`,
    );
  }
}

function loadPg(): { Client: new (config: object) => PgClient } {
  const root = join(__dirname, "..");
  const fromRoot = createRequire(join(root, "package.json"));
  try {
    return fromRoot("pg") as { Client: new (config: object) => PgClient };
  } catch {
    const pnpm = join(root, "node_modules", ".pnpm");
    const dir = readdirSync(pnpm).find((name) => /^pg@\d/.test(name));
    if (!dir) throw new Error("POSTGRES_CLIENT_UNAVAILABLE");
    return require(join(pnpm, dir, "node_modules", "pg")) as {
      Client: new (config: object) => PgClient;
    };
  }
}

type PgClient = {
  connect(): Promise<void>;
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
};

function connectionConfig(url: string, database: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionTimeoutMillis: 8000,
  };
}

async function withAdminClient<T>(
  fn: (client: PgClient) => Promise<T>,
): Promise<T> {
  const { Client } = loadPg();
  const client = new Client(connectionConfig(sourceUrl(), "postgres"));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ping(): Promise<void> {
  await withAdminClient(async (client) => {
    await client.query("select 1");
  });
}

function startLocalCompose(): void {
  if (isCi()) {
    throw new Error(
      "CI postgres is not reachable on localhost:5432; docker compose must not start it",
    );
  }
  const result = spawnSync("docker", ["compose", "up", "-d", "postgres"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error("docker compose up postgres failed");
  }
}

async function waitForPostgres(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await ping();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("PostgreSQL is not reachable");
}

async function ensureReachable(): Promise<void> {
  try {
    await ping();
    return;
  } catch (error) {
    if (isCi()) {
      throw new Error(
        `CI must reuse the GitHub Actions postgres service: ${String(error)}`,
      );
    }
    console.error(
      "Local postgres not reachable; starting docker compose postgres",
    );
    startLocalCompose();
    await waitForPostgres();
  }
}

async function resetE2eDatabase(): Promise<void> {
  assertE2eTarget();
  await ensureReachable();
  await withAdminClient(async (client) => {
    await client.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [E2E_DATABASE_NAME],
    );
    await client.query(`drop database if exists ${E2E_DATABASE_NAME}`);
    await client.query(`create database ${E2E_DATABASE_NAME}`);
  });
  console.error(`E2E database reset: ${E2E_DATABASE_NAME}`);
}

async function operatorTitleCount(marker: string): Promise<number> {
  const safe = marker.replaceAll("'", "''");
  const { Client } = loadPg();
  const client = new Client(connectionConfig(sourceUrl(), "achilles_store"));
  await client.connect();
  try {
    const result = await client.query(
      `select count(*)::int as count from product where deleted_at is null and title like '%${safe}%'`,
    );
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const countFlag = process.argv.indexOf("--operator-title-count");
  if (countFlag >= 0) {
    const marker = process.argv[countFlag + 1];
    if (!marker) throw new Error("operator title marker required");
    const count = await operatorTitleCount(marker);
    process.stdout.write(`${String(count)}\n`);
    return;
  }
  await resetE2eDatabase();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
