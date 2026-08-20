import Image from "next/image";

const assets = {
  horizontal: {
    src: "/brand/achilles-store-horizontal.svg",
    width: 390,
    height: 80,
  },
  symbol: {
    src: "/brand/achilles-store-symbol.svg",
    width: 72,
    height: 80,
  },
  monochrome: {
    src: "/brand/achilles-store-monochrome.svg",
    width: 390,
    height: 80,
  },
} as const;

export function BrandLogo({
  variant = "horizontal",
  priority = false,
}: {
  variant?: keyof typeof assets;
  priority?: boolean;
}) {
  const asset = assets[variant];
  return (
    <Image
      className={`brand-logo brand-logo--${variant}`}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt="Achilles Store"
      priority={priority}
    />
  );
}
