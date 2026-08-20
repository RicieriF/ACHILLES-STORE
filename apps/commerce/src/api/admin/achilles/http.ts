import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { z } from "zod";

export type AdminRequest = MedusaRequest & {
  auth_context?: { actor_id?: string };
};

export function actorId(request: AdminRequest): string | null {
  return request.auth_context?.actor_id ?? null;
}

export function parseOrReply<T>(
  schema: z.ZodType<T>,
  input: unknown,
  response: MedusaResponse,
): T | undefined {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Dados inválidos",
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return undefined;
  }
  return parsed.data;
}

export function conflict(response: MedusaResponse, message: string): void {
  response.status(409).json({ code: "CONFLICT", message });
}

export function notFound(response: MedusaResponse, entity: string): void {
  response
    .status(404)
    .json({ code: "NOT_FOUND", message: `${entity} não encontrado` });
}

export function stripUndefined<T extends object>(
  input: T,
): {
  [Key in keyof T]: Exclude<T[Key], undefined>;
} {
  return Object.fromEntries(
    Object.entries(input).filter((entry) => entry[1] !== undefined),
  ) as { [Key in keyof T]: Exclude<T[Key], undefined> };
}
