import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export function POST(request: MedusaRequest, response: MedusaResponse): void {
  if (request.params.operation !== "test") {
    response
      .status(404)
      .json({ code: "NOT_FOUND", message: "Operação Alibaba não encontrada" });
    return;
  }
  const configured = Boolean(
    process.env.ALIBABA_APP_KEY?.trim() &&
    process.env.ALIBABA_APP_SECRET?.trim(),
  );
  const authorized = Boolean(process.env.ALIBABA_ACCESS_TOKEN?.trim());
  response.status(503).json({
    connected: false,
    health: configured && authorized ? "UNAVAILABLE" : "NOT_CONFIGURED",
    latencyMs: 0,
    capabilities: {
      productLookup: false,
      supplierData: false,
      freight: false,
      tracking: false,
      orderCreate: false,
      orderPay: false,
    },
    error: {
      code: !configured
        ? "ALIBABA_NOT_CONFIGURED"
        : !authorized
          ? "ALIBABA_PERMISSION_REQUIRED"
          : "ALIBABA_UNAVAILABLE",
      message: !configured
        ? "Alibaba não configurado. App Key e App Secret são obrigatórios."
        : !authorized
          ? "Alibaba App configurado, mas a permissão/autorização ainda não foi concedida."
          : "A autorização não pôde ser validada por uma chamada oficial.",
    },
  });
}
