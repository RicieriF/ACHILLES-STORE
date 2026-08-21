export type ExtensionStatus = "CONFIGURED" | "NOT_CONFIGURED" | "DISABLED";

export type ExtensionCard = {
  id: string;
  name: string;
  category:
    "Observabilidade" | "Arquivos" | "Comunicação" | "Busca" | "Logística";
  status: ExtensionStatus;
  detail: string;
  configured: Record<string, boolean>;
};

const present = (environment: NodeJS.ProcessEnv, key: string) =>
  Boolean(environment[key]?.trim());

const complete = (environment: NodeJS.ProcessEnv, keys: string[]) =>
  keys.every((key) => present(environment, key));

export function extensionCards(
  environment: NodeJS.ProcessEnv = process.env,
): ExtensionCard[] {
  const production = environment.APP_ENV === "production";
  const s3Keys = [
    "S3_FILE_URL",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ENDPOINT",
  ];
  const s3 = complete(environment, s3Keys);
  const posthogEnabled = environment.POSTHOG_ENABLED === "true";
  return [
    {
      id: "sentry",
      name: "Sentry",
      category: "Observabilidade",
      status: present(environment, "SENTRY_DSN")
        ? "CONFIGURED"
        : "NOT_CONFIGURED",
      detail:
        "Status de configuração; nenhuma captura é alegada sem DSN e instrumentação ativa.",
      configured: { dsn: present(environment, "SENTRY_DSN") },
    },
    {
      id: "posthog",
      name: "PostHog",
      category: "Observabilidade",
      status: !posthogEnabled
        ? "DISABLED"
        : present(environment, "POSTHOG_KEY")
          ? "CONFIGURED"
          : "NOT_CONFIGURED",
      detail: posthogEnabled
        ? "Ativado por configuração; conectividade não sondada."
        : "Desativado por padrão para evitar coleta não consentida.",
      configured: {
        enabled: posthogEnabled,
        key: present(environment, "POSTHOG_KEY"),
        host: present(environment, "POSTHOG_HOST"),
      },
    },
    {
      id: "file-storage",
      name: "Armazenamento de arquivos",
      category: "Arquivos",
      status: s3 ? "CONFIGURED" : production ? "NOT_CONFIGURED" : "CONFIGURED",
      detail: s3
        ? "Provider S3 compatível configurado (AWS S3 ou Cloudflare R2)."
        : production
          ? "Produção requer configuração S3 compatível completa."
          : "Provider local do Medusa em uso somente para desenvolvimento.",
      configured: Object.fromEntries(
        s3Keys.map((key) => [
          key.replace("S3_", "").toLowerCase(),
          present(environment, key),
        ]),
      ),
    },
    {
      id: "resend",
      name: "Resend",
      category: "Comunicação",
      status:
        environment.RESEND_ENABLED !== "true"
          ? "DISABLED"
          : complete(environment, ["RESEND_API_KEY", "EMAIL_FROM"])
            ? "CONFIGURED"
            : "NOT_CONFIGURED",
      detail: "E-mail permanece desligado sem flag e configuração completas.",
      configured: {
        enabled: environment.RESEND_ENABLED === "true",
        apiKey: present(environment, "RESEND_API_KEY"),
        from: present(environment, "EMAIL_FROM"),
      },
    },
    {
      id: "meilisearch",
      name: "Meilisearch",
      category: "Busca",
      status: "NOT_CONFIGURED",
      detail: "Não instalado nesta missão; card reservado sem simular conexão.",
      configured: {},
    },
    {
      id: "shipstation",
      name: "ShipStation",
      category: "Logística",
      status: "NOT_CONFIGURED",
      detail: "Não instalado nesta missão; logística atual permanece manual.",
      configured: {},
    },
  ];
}

export function isS3Configured(environment: NodeJS.ProcessEnv = process.env) {
  return complete(environment, [
    "S3_FILE_URL",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ENDPOINT",
  ]);
}
