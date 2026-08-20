import type {
  IEventBusModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export const fulfillmentEventNames = [
  "customer_order.created",
  "supplier_plan.created",
  "supplier_gate.blocked",
  "supplier_gate.approved",
  "supplier_order.created",
  "supplier_order.confirmed",
  "fulfillment.shipped",
  "fulfillment.exception",
  "fulfillment.delivered",
] as const;
export type FulfillmentEventName = (typeof fulfillmentEventNames)[number];

export async function emitFulfillmentEvent(
  container: MedusaContainer,
  name: FulfillmentEventName,
  data: Record<string, unknown>,
): Promise<void> {
  await container.resolve<IEventBusModuleService>(Modules.EVENT_BUS).emit({
    name,
    data,
  });
}
