const active = new Set<string>();
const lastAttempt = new Map<string, number>();
export const IMPORT_COOLDOWN_MS = 15_000;

export class ImportRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Aguarde antes de reprocessar esta URL");
    this.name = "ImportRateLimitError";
  }
}
export async function withImportLock<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const previous = lastAttempt.get(key) ?? 0;
  if (active.has(key)) throw new ImportRateLimitError(IMPORT_COOLDOWN_MS);
  if (now - previous < IMPORT_COOLDOWN_MS)
    throw new ImportRateLimitError(IMPORT_COOLDOWN_MS - (now - previous));
  active.add(key);
  lastAttempt.set(key, now);
  try {
    return await operation();
  } finally {
    active.delete(key);
  }
}
export function resetImportLimits(): void {
  active.clear();
  lastAttempt.clear();
}
