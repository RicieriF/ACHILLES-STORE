import type { MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  getDashboard,
  type OperationsDatabase,
} from "../../../../../admin-operations/service";
import type { AdminRequest } from "../../http";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const database = request.scope.resolve<OperationsDatabase>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  response.json(await getDashboard(database));
}
