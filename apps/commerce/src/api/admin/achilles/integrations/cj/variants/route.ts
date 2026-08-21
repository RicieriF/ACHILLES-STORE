import {
  cjClientFromEnvironment,
  sanitizeCJError,
} from "@achilles/cj-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { normalizeCJVariants } from "../../../../../../integrations/provider-dto";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  try {
    const value = (name: string) =>
      typeof request.query[name] === "string" ? request.query[name] : undefined;
    const entries = ["pid", "productSku", "variantSku", "countryCode"].flatMap(
      (key) => {
        const entry = value(key);
        return entry ? [[key, entry] as const] : [];
      },
    );
    response.json({
      variants: normalizeCJVariants(
        await cjClientFromEnvironment().variants(Object.fromEntries(entries)),
      ),
    });
  } catch (error) {
    response.status(503).json(sanitizeCJError(error));
  }
}
