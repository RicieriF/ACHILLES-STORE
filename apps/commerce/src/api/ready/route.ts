import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { assessReadiness, type DatabaseProbe } from "../../lib/readiness";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const database = request.scope.resolve<DatabaseProbe>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  const report = await assessReadiness(database);
  response.status(report.ready ? 200 : 503).json({
    service: "commerce",
    ...report,
  });
}
