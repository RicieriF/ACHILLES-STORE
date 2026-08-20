import { NextResponse } from "next/server";

export function cartError(error: unknown): NextResponse {
  return NextResponse.json(
    {
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o carrinho",
    },
    { status: 409 },
  );
}

export function bodyObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function id(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(value))
    throw new Error("Identificador de carrinho inválido");
  return value;
}

export function quantity(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 99)
    throw new Error("Quantidade inválida");
  return Number(value);
}
