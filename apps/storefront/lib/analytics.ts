export type AchillesAnalyticsEvent =
  "page_view" | "product_view" | "add_to_cart" | "begin_checkout" | "purchase";
export type SafeAnalyticsProperties = Readonly<
  Record<string, string | number | boolean>
>;
const forbidden =
  /cpf|address|endereco|telefone|phone|email|token|card|payment/i;
export function track(
  _event: AchillesAnalyticsEvent,
  properties: SafeAnalyticsProperties = {},
): void {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  const id = process.env.NEXT_PUBLIC_ANALYTICS_ID;
  if (!provider || provider === "NONE" || !id) return;
  if (Object.keys(properties).some((key) => forbidden.test(key)))
    throw new Error("ANALYTICS_PII_FIELD_FORBIDDEN");
  // Provider delivery is deliberately not activated in TASK 014.
}
