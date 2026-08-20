import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  integrationCards,
  sanitizedOperationalConfig,
} from "../../../../integrations/status";

type Database = { raw(sql: string): Promise<unknown> };
export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const database = request.scope.resolve<Database>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  let postgres: "HEALTHY" | "UNAVAILABLE" = "HEALTHY";
  try {
    await database.raw("select 1");
  } catch {
    postgres = "UNAVAILABLE";
  }
  const integrations = integrationCards();
  const config = sanitizedOperationalConfig();
  response.json({
    integrations,
    config,
    health: [
      {
        service: "PostgreSQL",
        status: postgres,
        detail:
          postgres === "HEALTHY"
            ? "Consulta de prontidão concluída"
            : "Consulta falhou",
      },
      {
        service: "Commerce",
        status: "HEALTHY",
        detail: "/ready é o health check de implantação",
      },
      {
        service: "Storefront",
        status: config.store.storefrontBaseUrl ? "DEGRADED" : "NOT_CONFIGURED",
        detail:
          "URL configurada; validar pelo health check próprio /api/health",
      },
      ...integrations.map((item) => ({
        service: item.name,
        status: item.health,
        detail: item.detail,
      })),
    ],
    webhookUrl: config.store.publicBaseUrl
      ? `${config.store.publicBaseUrl}/webhooks/mercado-pago`
      : null,
  });
}
