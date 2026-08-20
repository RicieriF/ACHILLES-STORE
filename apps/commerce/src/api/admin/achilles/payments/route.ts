import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { paymentCapabilities } from "../../../../payment/provider";

type Database = {
  raw(sql: string, bindings?: readonly unknown[]): Promise<{ rows: Row[] }>;
};
type Row = {
  id: string;
  checkout_session_id: string;
  provider: string;
  provider_order_id: string | null;
  method: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};
export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const database = request.scope.resolve<Database>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  const result = await database.raw(
    `select id, checkout_session_id, provider, provider_order_id, method, amount, currency, status, created_at, updated_at, paid_at from payment_intent where deleted_at is null order by created_at desc limit 100`,
  );
  response.json({
    payments: result.rows,
    capabilities: paymentCapabilities(),
    refundsEnabled: false,
    supplierOrderAuthorized: false,
  });
}
