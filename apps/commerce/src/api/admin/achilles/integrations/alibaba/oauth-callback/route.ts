import {
  alibabaClientFromEnvironment,
  sanitizeAlibabaError,
} from "@achilles/alibaba-connector";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { consumeAlibabaOAuthState } from "../../../../../../integrations/alibaba-oauth-state";

export async function GET(
  request: MedusaRequest,
  response: MedusaResponse,
): Promise<void> {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state =
    typeof request.query.state === "string" ? request.query.state : "";
  if (!code || !consumeAlibabaOAuthState(state)) {
    response.status(400).json({
      code: "ALIBABA_OAUTH_INVALID_CALLBACK",
      message: "Callback Alibaba inválido ou expirado.",
    });
    return;
  }
  try {
    await alibabaClientFromEnvironment().exchangeAuthorizationCode(code);
    response.json({
      authorized: true,
      message:
        "Autorização recebida no servidor. Teste a conexão para validar permissões.",
    });
  } catch (error) {
    response.status(503).json(sanitizeAlibabaError(error));
  }
}
