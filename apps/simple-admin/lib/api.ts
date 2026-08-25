"use client";

const tokenKey = "achilles-simple-admin-token";
export const DEFAULT_API_TIMEOUT_MS = 25_000;
export const LONG_API_TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiOptions = RequestInit & { timeoutMs?: number };

export const session = {
  get: () =>
    typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(tokenKey),
  set: (token: string) => window.sessionStorage.setItem(tokenKey, token),
  clear: () => window.sessionStorage.removeItem(tokenKey),
};

export async function api<T>(path: string, init: ApiOptions = {}): Promise<T> {
  const token = session.get();
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...requestInit } = init;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/commerce/${path.replace(/^\//, "")}`, {
      ...requestInit,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...requestInit.headers,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as T & {
      code?: string;
      message?: string;
      [key: string]: unknown;
    };
    if (!response.ok) {
      if (response.status === 401 && path !== "auth/user/emailpass") {
        session.clear();
        window.location.replace("/?session=expired");
      }
      throw new ApiError(
        path === "auth/user/emailpass" && response.status === 401
          ? "E-mail ou senha incorretos."
          : payload.message || humanError(response.status),
        response.status,
        payload.code,
        payload,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "Esta operação demorou mais que o esperado. Tente novamente.",
        504,
        "SIMPLE_ADMIN_TIMEOUT",
      );
    }
    throw new ApiError(
      "Não consegui conectar aos serviços da Achilles Store.",
      null,
      "SIMPLE_ADMIN_NETWORK_ERROR",
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function humanError(status: number) {
  if (status === 401) return "Sua sessão terminou. Entre novamente.";
  if (status === 400 || status === 422)
    return "Revise os dados informados e tente novamente.";
  if (status === 409) return "Esta ação entra em conflito com o estado atual.";
  if (status === 504)
    return "Esta operação demorou mais que o esperado. Tente novamente.";
  if (status === 503)
    return "Não consegui conectar aos serviços da Achilles Store.";
  return "Não foi possível concluir esta ação. Tente novamente.";
}
