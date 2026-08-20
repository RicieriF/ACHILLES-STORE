import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoSignature(input: {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string | undefined;
  now?: number;
  toleranceSeconds?: number;
}): boolean {
  if (!input.signature || !input.requestId || !input.dataId || !input.secret)
    return false;
  const entries = new Map(
    input.signature.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = Number(entries.get("ts"));
  const received = entries.get("v1");
  if (
    !Number.isFinite(timestamp) ||
    !received ||
    !/^[a-f0-9]{64}$/i.test(received)
  )
    return false;
  const now = input.now ?? Date.now();
  const tolerance = (input.toleranceSeconds ?? 300) * 1000;
  if (Math.abs(now - timestamp * 1000) > tolerance) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${String(timestamp)};`;
  const expected = createHmac("sha256", input.secret)
    .update(manifest)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received.toLowerCase()),
  );
}
