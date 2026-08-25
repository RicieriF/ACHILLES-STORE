"use client";

const tokenKey = "achilles-simple-admin-token";

export const session = {
  get: () =>
    typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(tokenKey),
  set: (token: string) => window.sessionStorage.setItem(tokenKey, token),
  clear: () => window.sessionStorage.removeItem(tokenKey),
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = session.get();
  const response = await fetch(`/api/commerce/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };
  if (!response.ok)
    throw new Error(payload.message || humanError(response.status));
  return payload;
}

function humanError(status: number) {
  if (status === 401) return "Sua sessão terminou. Entre novamente.";
  if (status === 503)
    return "Não consegui conectar aos serviços da Achilles Store.";
  return "Não foi possível concluir esta ação. Tente novamente.";
}
