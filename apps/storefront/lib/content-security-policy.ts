type SecurityEnvironment = {
  APP_ENV?: string | undefined;
  NODE_ENV?: string | undefined;
};

export function isLocalDevelopment(environment: SecurityEnvironment): boolean {
  if (environment.NODE_ENV === "production") return false;
  const appEnvironment = environment.APP_ENV?.trim().toLowerCase();
  if (appEnvironment) {
    return appEnvironment === "development" || appEnvironment === "local";
  }
  return environment.NODE_ENV === "development";
}

export function contentSecurityPolicy(
  environment: SecurityEnvironment,
): string {
  const developmentEval = isLocalDevelopment(environment)
    ? " 'unsafe-eval'"
    : "";
  const productionSecurity =
    (environment.APP_ENV ?? environment.NODE_ENV) === "production";

  return `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${developmentEval} https://sdk.mercadopago.com; connect-src 'self' http://localhost:9000 https:; frame-src https://www.mercadopago.com https://sdk.mercadopago.com; form-action 'self'${productionSecurity ? "; upgrade-insecure-requests" : ""}`;
}
