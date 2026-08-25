"use client";
import { useEffect, useState } from "react";
import { Shell, Loading, ErrorState } from "../../components/shell";
import { api } from "../../lib/api";
type Settings = Record<string, unknown>;
export default function SettingsPage() {
  const [data, setData] = useState<Settings>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Settings>("admin/achilles/settings")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Shell title="Configurações">
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid two">
          <Section
            title="LOJA"
            text="Nome, logo e contato da Achilles Store."
            href="/avancado"
          />
          <Section
            title="PAGAMENTOS"
            text="Consulte o provider e o estado da configuração sem exibir credenciais."
            href="/avancado"
          />
          <Section
            title="ENTREGAS"
            text="Opções de frete e política operacional."
            href="/avancado"
          />
          <Section
            title="FORNECEDORES"
            text="CJ, Alibaba e fornecedores internos."
            href="/avancado"
          />
          <Section
            title="E-MAIL"
            text="Estado do serviço de mensagens."
            href="/avancado"
          />
          <Section
            title="ARQUIVOS E DOMÍNIO"
            text="Armazenamento e endereços públicos configurados."
            href="/avancado"
          />
        </div>
      )}
    </Shell>
  );
}
function Section({
  title,
  text,
  href,
}: {
  title: string;
  text: string;
  href: string;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <span className="badge">CONFIGURAÇÃO PROTEGIDA</span>
      <p style={{ marginTop: 16, marginBottom: 0 }}>
        <a className="button secondary" href={href}>
          ABRIR CONFIGURAÇÃO AVANÇADA
        </a>
      </p>
    </section>
  );
}
