import { z } from "zod";
import { normalizeBrazilPostalCode } from "../shipping/postal-code";

export const brazilStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const checkoutCustomerSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    email: z.email().trim().toLowerCase().max(254),
    phone: z.string().trim().min(10).max(20).transform(normalizeBrazilPhone),
  })
  .strict();

export const checkoutAddressSchema = z
  .object({
    postalCode: z.string().trim().transform(normalizeBrazilPostalCode),
    street: z.string().trim().min(2).max(160),
    number: z.string().trim().min(1).max(30),
    complement: z.string().trim().max(100).optional().nullable(),
    neighborhood: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().toUpperCase().pipe(z.enum(brazilStates)),
    countryCode: z.literal("BR").default("BR"),
  })
  .strict()
  .transform((value) => ({ ...value, complement: value.complement || null }));

export function normalizeBrazilPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (!/^[1-9]{2}9?\d{8}$/.test(national))
    throw new Error("Telefone brasileiro inválido");
  return `+55${national}`;
}

export function formatBrazilPostalCode(value: string): string {
  const normalized = normalizeBrazilPostalCode(value);
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}
