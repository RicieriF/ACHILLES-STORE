import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "ACHILLES STORE · Administração",
  description: "Administração operacional da Achilles Store",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
