import type { MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  getOperationalProduct,
  type OperationsDatabase,
} from "../../../../../../admin-operations/service";
import { notFound, type AdminRequest } from "../../../http";

export async function GET(
  request: AdminRequest,
  response: MedusaResponse,
): Promise<void> {
  const database = request.scope.resolve<OperationsDatabase>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  const product = await getOperationalProduct(
    database,
    request.params.id ?? "",
  );
  if (!product) {
    notFound(response, "Produto");
    return;
  }
  response.json({ product });
}
