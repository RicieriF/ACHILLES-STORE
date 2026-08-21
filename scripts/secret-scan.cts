const { readFileSync } = require("node:fs") as typeof import("node:fs");
const { execFileSync } =
  require("node:child_process") as typeof import("node:child_process");

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split(/\r?\n/u)
  .filter(Boolean);

const credentialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/u,
  /\bAPP_USR-[A-Za-z0-9_-]{20,}\b/u,
  /\bre_[A-Za-z0-9]{24,}\b/u,
] as const;
const secretAssignment =
  /^\s*(?:JWT_SECRET|COOKIE_SECRET|MERCADO_PAGO_ACCESS_TOKEN|MERCADO_PAGO_WEBHOOK_SECRET|ALIBABA_APP_SECRET|CJ_API_KEY|CJ_ACCESS_TOKEN|RESEND_API_KEY)\s*[:=]\s*["']?([^\s"']+)/u;
const knownSafeMarkers =
  /^(?:\$\{|replace_|ci_|test_|playwright_|local_development_only|<|example|fake|changeme)/iu;
const findings: string[] = [];

for (const file of files) {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  const scanAssignments = /(?:^|\/)(?:\.env[^/]*|[^/]+\.ya?ml)$/u.test(
    file.replaceAll("\\", "/"),
  );
  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    if (credentialPatterns.some((pattern) => pattern.test(line)))
      findings.push(`${file}:${index + 1}: credential-shaped value`);
    const assignment = scanAssignments ? secretAssignment.exec(line) : null;
    if (assignment?.[1] && !knownSafeMarkers.test(assignment[1]))
      findings.push(`${file}:${index + 1}: non-placeholder secret assignment`);
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(
  `Secret scan passed (${files.length} tracked/untracked files checked).`,
);
