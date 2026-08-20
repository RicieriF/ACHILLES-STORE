import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupplierProductRef } from "@achilles/domain";

const ALLOWED_HOSTS = new Set(["www.alibaba.com"]);
const PRODUCT_ID = /(?:product-detail\/[^/]*_|productId=)(\d{6,})/i;

export class AlibabaUrlError extends Error {
  constructor(
    readonly code:
      "INVALID_URL" | "UNSUPPORTED_HOST" | "SSRF_BLOCKED" | "REDIRECT_BLOCKED",
    message: string,
  ) {
    super(message);
    this.name = "AlibabaUrlError";
  }
}

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  )
    return true;
  const parts = normalized.split(".").map(Number);
  return (
    parts.length === 4 &&
    (parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) ||
      (parts[0] === 192 && parts[1] === 168))
  );
}

export function parseAlibabaUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AlibabaUrlError("INVALID_URL", "URL inválida");
  }
  if (url.protocol !== "https:")
    throw new AlibabaUrlError("INVALID_URL", "Somente HTTPS é aceito");
  if (url.username || url.password)
    throw new AlibabaUrlError(
      "INVALID_URL",
      "Credenciais embutidas na URL não são aceitas",
    );
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host))
    throw new AlibabaUrlError("SSRF_BLOCKED", "Endereços IP não são aceitos");
  if (!ALLOWED_HOSTS.has(host))
    throw new AlibabaUrlError("UNSUPPORTED_HOST", "Host Alibaba não permitido");
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|spm$|src$|source$)/i.test(key)) url.searchParams.delete(key);
  }
  return url;
}

export async function assertPublicAlibabaUrl(value: string): Promise<URL> {
  const url = parseAlibabaUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => privateAddress(address))
  ) {
    throw new AlibabaUrlError(
      "SSRF_BLOCKED",
      "O host não resolveu para endereço público seguro",
    );
  }
  return url;
}

export function productReference(url: URL): SupplierProductRef {
  const match = `${url.pathname}${url.search}`.match(PRODUCT_ID);
  return {
    provider: "ALIBABA",
    supplierProductId: match?.[1] ?? "",
    sourceUrl: url.toString(),
  };
}

export function validateRedirect(from: URL, location: string): URL {
  const target = parseAlibabaUrl(new URL(location, from).toString());
  if (!ALLOWED_HOSTS.has(target.hostname.toLowerCase()))
    throw new AlibabaUrlError(
      "REDIRECT_BLOCKED",
      "Redirecionamento para host não permitido",
    );
  return target;
}
