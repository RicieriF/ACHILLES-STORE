export type AssistedSource = {
  provider: "ALIBABA" | "ALIEXPRESS" | "OTHER";
  canonicalUrl: string;
  externalProductId: string | null;
};
export class AssistedSourceError extends Error {
  constructor(
    readonly code:
      "SOURCE_HTTPS_REQUIRED" | "SOURCE_HOST_BLOCKED" | "SOURCE_URL_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "AssistedSourceError";
  }
}

const allowedAlibaba = new Set(["alibaba.com", "www.alibaba.com"]);
const allowedAliExpress = new Set([
  "aliexpress.com",
  "www.aliexpress.com",
  "pt.aliexpress.com",
]);

export function identifyAssistedSource(source: string): AssistedSource {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new AssistedSourceError(
      "SOURCE_URL_INVALID",
      "Informe uma URL válida do fornecedor.",
    );
  }
  if (url.protocol !== "https:")
    throw new AssistedSourceError(
      "SOURCE_HTTPS_REQUIRED",
      "A URL do fornecedor deve usar HTTPS.",
    );
  url.hash = "";
  const host = url.hostname.toLowerCase();
  if (allowedAlibaba.has(host)) {
    const id =
      url.pathname.match(/(?:_|\/)(\d{6,30})(?:\.html)?(?:\/|$)/)?.[1] ?? null;
    return {
      provider: "ALIBABA",
      canonicalUrl: url.toString(),
      externalProductId: id,
    };
  }
  if (allowedAliExpress.has(host)) {
    const id =
      url.pathname.match(/\/item\/(\d{6,30})(?:\.html)?(?:\/|$)/)?.[1] ?? null;
    return {
      provider: "ALIEXPRESS",
      canonicalUrl: url.toString(),
      externalProductId: id,
    };
  }
  if (
    url.username ||
    url.password ||
    ["localhost", "127.0.0.1", "::1"].includes(host)
  )
    throw new AssistedSourceError(
      "SOURCE_HOST_BLOCKED",
      "Este endereço de fornecedor não é permitido.",
    );
  return {
    provider: "OTHER",
    canonicalUrl: url.toString(),
    externalProductId: null,
  };
}
