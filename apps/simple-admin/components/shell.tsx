"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { session } from "../lib/api";

const links = [
  ["/inicio", "INÍCIO"],
  ["/vitrine", "MINHA VITRINE"],
  ["/adicionar", "ADICIONAR PRODUTO"],
  ["/pedidos", "PEDIDOS"],
  ["/clientes", "CLIENTES"],
  ["/configuracoes", "CONFIGURAÇÕES"],
  ["/avancado", "AVANÇADO"],
] as const;

export function Shell({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <span>A</span>
          <div>
            ACHILLES<small>STORE</small>
          </div>
        </div>
        <nav>
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          className="link-button"
          onClick={() => {
            session.clear();
            router.push("/");
          }}
        >
          Sair
        </button>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">OPERAÇÃO DA LOJA</p>
            <h1>{title}</h1>
          </div>
          {action}
        </header>
        {children}
      </main>
    </div>
  );
}

export function Loading() {
  return <div className="state">Carregando dados da Achilles Store…</div>;
}
export function ErrorState({ message }: { message: string }) {
  return <div className="state error">{message}</div>;
}
export const money = (value?: number | null) =>
  value == null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
