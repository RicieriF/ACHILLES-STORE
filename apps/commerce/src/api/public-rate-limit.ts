import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();
export function publicRateLimit(
  request: MedusaRequest,
  response: MedusaResponse,
  next: MedusaNextFunction,
): void {
  const now = Date.now();
  const forwarded = request.headers["x-forwarded-for"];
  const identity =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.trim() ||
    request.socket.remoteAddress ||
    "unknown";
  const key = `${identity}:${request.path}`;
  const current = buckets.get(key);
  const bucket =
    !current || current.resetsAt <= now
      ? { count: 0, resetsAt: now + 60_000 }
      : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  response.setHeader("RateLimit-Limit", "120");
  response.setHeader(
    "RateLimit-Remaining",
    String(Math.max(0, 120 - bucket.count)),
  );
  if (bucket.count > 120) {
    response.setHeader(
      "Retry-After",
      String(Math.ceil((bucket.resetsAt - now) / 1000)),
    );
    response.status(429).json({
      code: "RATE_LIMITED",
      message: "Muitas solicitações. Tente novamente em instantes.",
    });
    return;
  }
  next();
}
export function resetPublicRateLimits(): void {
  buckets.clear();
}
