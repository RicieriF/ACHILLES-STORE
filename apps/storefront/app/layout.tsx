import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import { SiteHeader } from "../components/layout/site-header";
import { SiteFooter } from "../components/layout/site-footer";
import { CartProvider } from "../components/cart/cart-provider";
import { getPublicCatalog } from "../lib/commerce";

export const metadata: Metadata = {
  title: {
    default: "Achilles Store — Equipamentos para ir mais longe",
    template: "%s | Achilles Store",
  },
  description:
    "Equipamentos outdoor, EDC, camping e iluminação selecionados para jornadas reais.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://achilles.example.invalid",
  ),
  openGraph: {
    title: "Achilles Store — Outdoor, EDC e equipamentos",
    description:
      "Equipamentos premium para outdoor, EDC, camping e iluminação.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/brand/achilles-store-og.svg",
        width: 1200,
        height: 630,
        alt: "Achilles Store — equipamentos para ir mais longe",
      },
    ],
  },
  icons: { icon: "/brand/favicon.svg" },
  other: { "theme-color": "#111315" },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const catalog = await getPublicCatalog().catch(() => null);
  const categories = catalog?.categories ?? [];
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <CartProvider>
          <SiteHeader categories={categories} />
          {children}
          <SiteFooter categories={categories} />
        </CartProvider>
      </body>
    </html>
  );
}
