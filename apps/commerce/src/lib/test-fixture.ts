export function isTestRuntime(): boolean {
  return process.env.APP_ENV === "test";
}

export function isFixtureSourceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /example\.invalid|fixture\.invalid/i.test(url);
}

export function testFixtureMetadata(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const marked =
    extra.achilles_test_fixture === true ||
    isTestRuntime() ||
    (typeof extra.source_url === "string" &&
      isFixtureSourceUrl(extra.source_url));
  if (!marked) return extra;
  return { ...extra, achilles_test_fixture: true };
}

export function testFixtureProviderMetadata(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return isTestRuntime() ? { achilles_test_fixture: true, ...extra } : extra;
}
