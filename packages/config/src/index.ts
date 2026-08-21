import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

export function findWorkspaceRoot(startDirectory: string): string {
  const current = resolve(startDirectory);
  if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
  const parent = dirname(current);
  if (parent === current)
    throw new Error("Could not locate pnpm workspace root");
  return findWorkspaceRoot(parent);
}

const disabledByDefault = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
const corsOrigins = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .every((origin) => z.url().safeParse(origin).success),
    "CORS must be a comma-separated list of absolute URLs",
  );
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);
const featureFlagSchema = z.object({
  ALIBABA_ENABLED: disabledByDefault,
  ALIBABA_PRODUCT_IMPORT: disabledByDefault,
  ALIBABA_FREIGHT_QUOTE: disabledByDefault,
  ALIBABA_ORDER_CREATE: disabledByDefault,
  ALIBABA_ORDER_PAY: disabledByDefault,
  ALIBABA_TRACKING: disabledByDefault,
  CJ_ENABLED: disabledByDefault,
  CJ_PRODUCT_IMPORT: disabledByDefault,
  CJ_STOCK: disabledByDefault,
  CJ_SHIPPING: disabledByDefault,
  CJ_ORDER_CREATE: disabledByDefault,
  CJ_ORDER_PAY: disabledByDefault,
  CJ_TRACKING: disabledByDefault,
  EMAIL_ENABLED: disabledByDefault,
  RESEND_ENABLED: disabledByDefault,
  VIACEP_ENABLED: disabledByDefault,
  PREFER_BRAZIL_STOCK_WHEN_COMPETITIVE: disabledByDefault,
  MERCADO_PAGO_ENABLED: disabledByDefault,
  MERCADO_PAGO_PIX: disabledByDefault,
  MERCADO_PAGO_CARD: disabledByDefault,
  MERCADO_PAGO_BOLETO: disabledByDefault,
});

export type FeatureFlags = z.output<typeof featureFlagSchema>;
export function parseFeatureFlags(
  environment: Readonly<Record<string, string | undefined>>,
): FeatureFlags {
  return featureFlagSchema.parse(environment);
}

export const serverEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    DATABASE_URL: z
      .url()
      .startsWith("postgres://")
      .or(z.url().startsWith("postgresql://")),
    STORE_CORS: corsOrigins,
    ADMIN_CORS: corsOrigins,
    AUTH_CORS: corsOrigins,
    JWT_SECRET: z.string().min(24),
    COOKIE_SECRET: z.string().min(24),
    PUBLIC_BASE_URL: optionalUrl,
    STOREFRONT_BASE_URL: optionalUrl,
    REDIS_URL: optionalUrl,
    BUSINESS_LOCALE: z.string().min(2).default("pt-BR"),
    DISPLAY_TIMEZONE: z
      .string()
      .refine(
        (timezone) => {
          try {
            new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
            return true;
          } catch {
            return false;
          }
        },
        { message: "DISPLAY_TIMEZONE must be a valid IANA timezone" },
      )
      .default("America/Sao_Paulo"),
  })
  .and(featureFlagSchema)
  .superRefine((environment, context) => {
    if (environment.APP_ENV === "production") {
      for (const [name, value] of [
        ["STORE_CORS", environment.STORE_CORS],
        ["ADMIN_CORS", environment.ADMIN_CORS],
        ["AUTH_CORS", environment.AUTH_CORS],
      ] as const) {
        if (value.includes("*"))
          context.addIssue({
            code: "custom",
            path: [name],
            message: `${name} cannot contain wildcard in production`,
          });
      }
    }
  });

export function parseServerEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return serverEnvironmentSchema.parse(environment);
}
