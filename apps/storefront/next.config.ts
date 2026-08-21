import { loadEnvConfig } from "@next/env";
import { findWorkspaceRoot } from "@achilles/config";
import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/content-security-policy";

loadEnvConfig(findWorkspaceRoot(process.cwd()));

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
            value: contentSecurityPolicy(process.env),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
