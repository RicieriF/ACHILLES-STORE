import type { MedusaResponse } from "@medusajs/framework/http";
import { PublicCartError } from "../../../../cart/public-cart";

export function cartBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 99)
    throw new PublicCartError(
      "INVALID_CART_INPUT",
      `${field} deve ser um inteiro entre 1 e 99`,
    );
  return Number(value);
}

export function requiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(value))
    throw new PublicCartError("INVALID_CART_INPUT", `${field} inválido`);
  return value;
}

export function sendCartError(response: MedusaResponse, error: unknown): void {
  if (error instanceof PublicCartError) {
    const status = error.code === "CART_NOT_FOUND" ? 404 : 409;
    response.status(status).json({ code: error.code, message: error.message });
    return;
  }
  response.status(500).json({
    code: "CART_OPERATION_FAILED",
    message: "Não foi possível atualizar o carrinho",
  });
}
