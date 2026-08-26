import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

type CustomerRow = {
  email: string;
  name: string | null;
  order_count: number;
  total_spent: string;
  last_order_at: Date | string;
};

type Database = {
  raw(sql: string): Promise<{ rows: CustomerRow[] }>;
};

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const database = request.scope.resolve<Database>(
    ContainerRegistrationKeys.PG_CONNECTION,
  );
  const result = await database.raw(`
    select lower(customer_snapshot->>'email') as email,
      (array_agg(nullif(customer_snapshot->>'name', '') order by created_at desc))[1] as name,
      count(*)::int as order_count,
      coalesce(sum(total_paid::numeric), 0)::text as total_spent,
      max(created_at) as last_order_at
    from customer_order
    where deleted_at is null
      and nullif(customer_snapshot->>'email', '') is not null
    group by lower(customer_snapshot->>'email')
    order by max(created_at) desc
    limit 100
  `);
  response.json({
    customers: result.rows.map((customer) => ({
      id: customer.email,
      name: customer.name,
      email: customer.email,
      orderCount: customer.order_count,
      totalSpent: Number(customer.total_spent),
      lastOrderAt: new Date(customer.last_order_at).toISOString(),
    })),
  });
}
