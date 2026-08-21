import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getRuntimeProviderHealth } from "../../../../../../integrations/runtime-health";

export function GET(_request: MedusaRequest, response: MedusaResponse): void {
  const appConfigured = Boolean(
    process.env.ALIBABA_APP_KEY?.trim() &&
    process.env.ALIBABA_APP_SECRET?.trim(),
  );
  const authorized = Boolean(process.env.ALIBABA_ACCESS_TOKEN?.trim());
  const runtime = getRuntimeProviderHealth("ALIBABA");
  response.json({
    provider: "ALIBABA",
    appConfigured,
    authorized,
    status: !appConfigured
      ? "NOT_CONFIGURED"
      : !authorized
        ? "PERMISSION_REQUIRED"
        : runtime?.connected
          ? "CONNECTED"
          : "VALIDATION_REQUIRED",
    capabilities: {
      productLookup: runtime?.capabilities.productLookup
        ? "GRANTED"
        : "NOT_VALIDATED",
      supplierData: runtime?.capabilities.supplierData
        ? "GRANTED"
        : "NOT_VALIDATED",
      freightQuote: runtime?.capabilities.freight ? "GRANTED" : "NOT_VALIDATED",
      tracking: runtime?.capabilities.tracking ? "GRANTED" : "NOT_VALIDATED",
      orderCreate: "OFF",
      orderPay: "OFF",
    },
    message: !appConfigured
      ? "Configure a aplicação Alibaba Open Platform."
      : !authorized
        ? "Permissão necessária: conclua a autorização oficial da aplicação."
        : "Tokens presentes; valide as permissões com uma chamada oficial antes de considerar conectado.",
  });
}
