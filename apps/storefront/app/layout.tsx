import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import { SiteHeader } from "../components/layout/site-header";
import { SiteFooter } from "../components/layout/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Achilles Store — Equipamentos para ir mais longe",
    template: "%s | Achilles Store",
  },
  description:
    "Equipamentos outdoor selecionados para camping, iluminação e jornadas reais.",
  metadataBase: new URL("https://achilles.example.invalid"),
  openGraph: {
    title: "Achilles Store",
    description: "Equipamentos para ir mais longe.",
    type: "website",
    locale: "pt_BR",
    images: ["/images/og-placeholder.svg"],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
