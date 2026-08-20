import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { findWorkspaceRoot, parseServerEnvironment } from "@achilles/config";

const runtimeEnvironment = { ...process.env };
loadEnv(
  process.env.NODE_ENV ?? "development",
  findWorkspaceRoot(process.cwd()),
);
Object.assign(process.env, runtimeEnvironment);
const environment = parseServerEnvironment(process.env);

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: environment.DATABASE_URL,
    http: {
      storeCors: environment.STORE_CORS,
      adminCors: environment.ADMIN_CORS,
      authCors: environment.AUTH_CORS,
      jwtSecret: environment.JWT_SECRET,
      cookieSecret: environment.COOKIE_SECRET,
    },
  },
  modules: [{ resolve: "./src/modules/supplier-domain" }],
});
