export class PostalCodeError extends Error {
  constructor(message = "CEP deve conter 8 dígitos") {
    super(message);
    this.name = "PostalCodeError";
  }
}

export function normalizeBrazilPostalCode(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{5}-?\d{3}$/.test(trimmed)) throw new PostalCodeError();
  return trimmed.replace("-", "");
}
