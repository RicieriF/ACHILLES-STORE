import { z } from "zod";

const disabledByDefault = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");
const featureFlagSchema = z.object({
  ALIBABA_PRODUCT_IMPORT: disabledByDefault,
  ALIBABA_FREIGHT_QUOTE: disabledByDefault,
  ALIBABA_ORDER_CREATE: disabledByDefault,
  ALIBABA_ORDER_PAY: disabledByDefault,
  ALIBABA_TRACKING: disabledByDefault,
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
    DATABASE_URL: z
      .url()
      .startsWith("postgres://")
      .or(z.url().startsWith("postgresql://")),
    STORE_CORS: z.url(),
    ADMIN_CORS: z.url(),
    AUTH_CORS: z.string().min(1),
    JWT_SECRET: z.string().min(24),
    COOKIE_SECRET: z.string().min(24),
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
  .and(featureFlagSchema);

export function parseServerEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return serverEnvironmentSchema.parse(environment);
}
