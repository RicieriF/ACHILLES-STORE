import { loadEnvConfig } from "@next/env";
import { findWorkspaceRoot } from "@achilles/config";
import type { NextConfig } from "next";

loadEnvConfig(findWorkspaceRoot(process.cwd()));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
