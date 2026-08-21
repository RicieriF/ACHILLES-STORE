import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { findWorkspaceRoot, parseServerEnvironment } from "@achilles/config";
import { isS3Configured } from "./src/admin-operations/extensions";

const runtimeEnvironment = { ...process.env };
loadEnv(
  process.env.NODE_ENV ?? "development",
  findWorkspaceRoot(process.cwd()),
);
Object.assign(process.env, runtimeEnvironment);
const environment = parseServerEnvironment(process.env);
const s3Configured = isS3Configured(process.env);

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
  modules: [
    { resolve: "./src/modules/supplier-domain" },
    ...(s3Configured
      ? [
          {
            resolve: "@medusajs/medusa/file",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/file-s3",
                  id: "s3",
                  options: {
                    file_url: process.env.S3_FILE_URL,
                    access_key_id: process.env.S3_ACCESS_KEY_ID,
                    secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                    region: process.env.S3_REGION,
                    bucket: process.env.S3_BUCKET,
                    endpoint: process.env.S3_ENDPOINT,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
});
