import { loadEnvConfig } from "@next/env";
import { findWorkspaceRoot } from "@achilles/config";
import type { NextConfig } from "next";

loadEnvConfig(findWorkspaceRoot(process.cwd()));
const productionSecurity =
  (process.env.APP_ENV ?? process.env.NODE_ENV) === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com; connect-src 'self' http://localhost:9000 https:; frame-src https://www.mercadopago.com https://sdk.mercadopago.com; form-action 'self'${productionSecurity ? "; upgrade-insecure-requests" : ""}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
