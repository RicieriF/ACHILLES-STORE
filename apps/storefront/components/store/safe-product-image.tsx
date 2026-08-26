"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export const productImagePlaceholder = "/images/product-placeholder.svg";

const allowedProductImageHosts = new Set([
  "oss-cf.cjdropshipping.com",
  "cf.cjdropshipping.com",
]);

export function safeProductImageSource(source?: string | null): string {
  if (!source) return productImagePlaceholder;
  if (source.startsWith("/") && !source.startsWith("//")) return source;

  try {
    const url = new URL(source);
    return url.protocol === "https:" &&
      allowedProductImageHosts.has(url.hostname)
      ? url.toString()
      : productImagePlaceholder;
  } catch {
    return productImagePlaceholder;
  }
}

export function SafeProductImage({
  src,
  alt,
  onError,
  ...props
}: Omit<ImageProps, "src"> & { src?: string | null }) {
  const normalizedSource = safeProductImageSource(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const displayedSource =
    failedSource === normalizedSource
      ? productImagePlaceholder
      : normalizedSource;

  return (
    <Image
      {...props}
      src={displayedSource}
      alt={alt}
      onError={(event) => {
        if (displayedSource !== productImagePlaceholder) {
          setFailedSource(normalizedSource);
        }
        onError?.(event);
      }}
    />
  );
}
