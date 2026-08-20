export const requiredCommerceTables = [
  "supplier",
  "supplier_offer",
  "supplier_variant_map",
  "branding_profile",
  "audit_event",
  "import_draft",
  "import_attempt",
  "product_policy",
  "cost_quote",
  "pricing_snapshot",
  "shipping_quote",
  "checkout_session",
  "checkout_shipping_selection",
  "taxpayer_identity",
  "payment_intent",
  "payment_provider_event",
] as const;

export interface DatabaseProbe {
  raw<T>(query: string, bindings?: readonly unknown[]): Promise<T>;
}

interface TableProbeResult {
  rows: Array<{ table_name: string | null }>;
}

export interface ReadinessReport {
  ready: boolean;
  checks: {
    process: "up";
    configuration: "valid";
    database: "accessible" | "unavailable";
    migrations: "current" | "pending_or_missing" | "unknown";
  };
  missingTables: readonly string[];
}

export async function assessReadiness(
  database: DatabaseProbe,
): Promise<ReadinessReport> {
  try {
    await database.raw("SELECT 1");
    const placeholders = requiredCommerceTables.map(() => "?").join(", ");
    const result = await database.raw<TableProbeResult>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${placeholders})`,
      requiredCommerceTables,
    );
    const presentTables = new Set(
      result.rows
        .map((row) => row.table_name)
        .filter((tableName): tableName is string => tableName !== null),
    );
    const missingTables = requiredCommerceTables.filter(
      (tableName) => !presentTables.has(tableName),
    );

    return {
      ready: missingTables.length === 0,
      checks: {
        process: "up",
        configuration: "valid",
        database: "accessible",
        migrations:
          missingTables.length === 0 ? "current" : "pending_or_missing",
      },
      missingTables,
    };
  } catch {
    return {
      ready: false,
      checks: {
        process: "up",
        configuration: "valid",
        database: "unavailable",
        migrations: "unknown",
      },
      missingTables: [...requiredCommerceTables],
    };
  }
}
