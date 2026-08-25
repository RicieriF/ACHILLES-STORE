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
          />
          <Section
            title="PAGAMENTOS"
            text="Consulte o provider e o estado da configuração sem exibir credenciais."
          />
          <Section
            title="ENTREGAS"
            text="Opções de frete e política operacional."
          />
          <Section
            title="FORNECEDORES"
            text="CJ, Alibaba e fornecedores internos."
          />
          <Section title="E-MAIL" text="Estado do serviço de mensagens." />
          <Section
            title="ARQUIVOS E DOMÍNIO"
            text="Armazenamento e endereços públicos configurados."
          />
        </div>
      )}
    </Shell>
  );
}
function Section({ title, text }: { title: string; text: string }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <span className="badge">CONFIGURAÇÃO PROTEGIDA</span>
    </section>
  );
}
