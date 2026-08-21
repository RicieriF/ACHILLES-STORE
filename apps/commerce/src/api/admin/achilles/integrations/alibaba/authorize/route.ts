import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { issueAlibabaOAuthState } from "../../../../../../integrations/alibaba-oauth-state";

export function GET(_request: MedusaRequest, response: MedusaResponse): void {
  const clientId = process.env.ALIBABA_APP_KEY?.trim();
  const redirectUri = process.env.ALIBABA_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    response.status(409).json({
      code: "ALIBABA_NOT_CONFIGURED",
      message: "Configure App Key e OAuth Redirect URI no servidor.",
    });
    return;
  }
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: issueAlibabaOAuthState(),
    view: "web",
    sp: "ICBU",
  });
  response.json({
    authorizationUrl: `https://oauth.alibaba.com/authorize?${query.toString()}`,
  });
}
