interface SerializedLinkable {
  serviceName: string;
  field: string;
  linkable: string;
  primaryKey: string;
  entity?: string;
}

export type MedusaLinkable = Record<string, unknown> & {
  toJSON: () => SerializedLinkable;
};

export function requireMedusaLinkable(value: unknown): MedusaLinkable {
  if (
    typeof value !== "object" ||
    value === null ||
    !("toJSON" in value) ||
    typeof value.toJSON !== "function"
  ) {
    throw new TypeError("Medusa module did not expose a valid linkable model");
  }

  return value as MedusaLinkable;
}
