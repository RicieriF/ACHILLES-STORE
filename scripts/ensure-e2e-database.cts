const { spawnSync } =
  require("node:child_process") as typeof import("node:child_process");

function psql(sql: string) {
  return spawnSync(
    `docker compose exec -T postgres psql -U achilles -d postgres -tAc "${sql.replaceAll('"', '\\"')}"`,
    { encoding: "utf8", shell: true },
  );
}

function run(sql: string) {
  const result = psql(sql);
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

run(
  "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'achilles_store_e2e' and pid <> pg_backend_pid()",
);
run("drop database if exists achilles_store_e2e");
run("create database achilles_store_e2e");
console.log("E2E database reset: achilles_store_e2e");
