import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export function GET(_request: MedusaRequest, response: MedusaResponse): void {
  const appConfigured = Boolean(
    process.env.ALIBABA_APP_KEY?.trim() &&
    process.env.ALIBABA_APP_SECRET?.trim(),
  );
  const authorized = Boolean(process.env.ALIBABA_ACCESS_TOKEN?.trim());
  response.json({
    provider: "ALIBABA",
    appConfigured,
    authorized,
    status: !appConfigured
      ? "NOT_CONFIGURED"
      : !authorized
        ? "PERMISSION_REQUIRED"
        : "VALIDATION_REQUIRED",
    capabilities: {
      productSearch: "NOT_VALIDATED",
      supplierData: "NOT_VALIDATED",
      freightQuote: "NOT_VALIDATED",
      tracking: "NOT_VALIDATED",
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
