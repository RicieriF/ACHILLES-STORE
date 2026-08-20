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
    "Equipamentos outdoor selecionados para camping, iluminação e jornadas reais.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://achilles.example.invalid",
  ),
  openGraph: {
    title: "Achilles Store",
    description: "Equipamentos para ir mais longe.",
    type: "website",
    locale: "pt_BR",
    images: ["/images/og-placeholder.svg"],
  },
  icons: { icon: "/favicon.svg" },
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
